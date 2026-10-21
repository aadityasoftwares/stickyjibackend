import { subscriptionEntitlementService } from "../../subscriptionentitlement/services/subscriptionentitlement.service.js";
import { FeatureCode } from "../../feature/constants/feature.enums.js";
import { isWorkspaceTrashed } from "../../workspace/constants/workspace.enums.js";
import { Types } from "mongoose";

import { AppError } from "../../../utils/errors/app.error.js";
import { AppModule } from "../../../utils/enums/appModule.enums.js";
import { AuditLogAction } from "../../auditlog/constants/auditLog.enums.js";
import { AuditLogService } from "../../auditlog/services/auditLog.service.js";
import type { IAuditLogContext } from "../../auditlog/interfaces/auditLog.interface.js";
import { StickyNoteStatus } from "../../stickynotes/constants/stickyNote.enums.js";
import { StickyNoteModel } from "../../stickynotes/models/stickynote.model.js";
import { WorkspaceModel } from "../../workspace/models/workspace.model.js";
import { WorkspaceMemberModel } from "../../workspaceMember/models/workspaceMember.model.js";
import { WorkspaceMemberStatus } from "../../workspaceMember/constants/workspaceMember.enums.js";
import { UserModel } from "../../user/models/user.model.js";
import { STICKY_NOTE_ASSIGNEE_CONSTANTS } from "../constants/stickyNoteAssignee.constants.js";
import { StickyNoteAssigneeStatus } from "../constants/stickyNoteAssignee.enums.js";
import { StickyNoteAssigneeMessages } from "../constants/stickyNoteAssignee.messages.js";
import type {
    IStickyNoteAssigneeCreate,
    IStickyNoteAssigneeFilter,
    IStickyNoteAssigneePaginatedResult,
    IStickyNoteAssigneeResponse,
    IStickyNoteAssigneeSync,
} from "../interfaces/stickyNoteAssignee.interface.js";
import { StickyNoteAssigneeRepository } from "../repositories/stickyNoteAssignee.repository.js";
import { StickyNoteAssigneeValidation } from "../validations/stickyNoteAssignee.validation.js";

interface IStickyNoteAssignmentTarget {
    _id: Types.ObjectId;
    workspaceId: Types.ObjectId;
    title?: string;
    status: StickyNoteStatus;
}

interface IActiveWorkspaceMemberLean {
    userId: Types.ObjectId;
}

export class StickyNoteAssigneeService {
    private readonly stickyNoteAssigneeRepository: StickyNoteAssigneeRepository;
    private readonly auditLogService: AuditLogService;

    constructor() {
        this.stickyNoteAssigneeRepository = new StickyNoteAssigneeRepository();
        this.auditLogService = new AuditLogService();
    }

    async createStickyNoteAssignee(
        data: IStickyNoteAssigneeCreate,
        assignedBy: string,
        context?: IAuditLogContext,
    ): Promise<IStickyNoteAssigneeResponse> {
        const stickyNoteId = String(data.stickyNoteId);
        const userId = String(data.userId);

        const stickyNote = await this.getAssignmentTarget(stickyNoteId, true);
        const workspaceId = stickyNote.workspaceId.toString();
        await subscriptionEntitlementService.assertWorkspaceFeature(workspaceId, FeatureCode.SHARED_NOTES);

        const [existing, activeCount] = await Promise.all([
            this.stickyNoteAssigneeRepository.findByNoteAndUser(stickyNoteId, userId),
            this.stickyNoteAssigneeRepository.countActiveByStickyNote(stickyNoteId),
            this.assertAssignmentMembers(workspaceId, assignedBy, [userId]),
        ]);

        if (existing?.status === StickyNoteAssigneeStatus.ACTIVE) {
            return this.toResponse(existing);
        }

        if (activeCount >= STICKY_NOTE_ASSIGNEE_CONSTANTS.MAX_PER_NOTE) {
            throw new AppError(StickyNoteAssigneeMessages.MAX_ASSIGNEES_REACHED, 400);
        }

        const isReactivation = existing?.status === StickyNoteAssigneeStatus.REMOVED;
        const assignee = await this.stickyNoteAssigneeRepository.createOrReactivate(
            workspaceId,
            stickyNoteId,
            userId,
            assignedBy,
        );

        if (!assignee) {
            throw new AppError(StickyNoteAssigneeMessages.NOT_FOUND, 404);
        }

        await this.auditLogService.log({
            ...context,
            action: isReactivation ? AuditLogAction.RESTORE : AuditLogAction.ASSIGN,
            module: AppModule.STICKY_NOTE_ASSIGNEE,
            resourceId: assignee._id.toString(),
            resourceName: "Sticky Note Assignee",
            description: `User "${userId}" was assigned to sticky note "${stickyNote.title || stickyNoteId}".`,
        });

        await this.logAssignmentChange(stickyNote, context, isReactivation ? [userId] : [], [userId], []);

        return this.toResponse(assignee);
    }

    async getStickyNoteAssigneeById(id: string, requestedBy: string): Promise<IStickyNoteAssigneeResponse> {
        const assignee = await this.stickyNoteAssigneeRepository.findById(id);

        if (!assignee) {
            throw new AppError(StickyNoteAssigneeMessages.NOT_FOUND, 404);
        }

        await this.assertActorMembership(this.getReferenceId(assignee.workspaceId), requestedBy);

        return this.toResponse(assignee);
    }

    async getAssigneesByStickyNoteId(
        stickyNoteId: string,
        requestedBy: string,
    ): Promise<IStickyNoteAssigneeResponse[]> {
        if (!StickyNoteAssigneeValidation.isValidObjectId(stickyNoteId)) {
            throw new AppError(StickyNoteAssigneeMessages.INVALID_STICKY_NOTE_ID, 400);
        }

        const stickyNote = await this.getAssignmentTarget(stickyNoteId, false);
        const workspaceId = stickyNote.workspaceId.toString();

        await this.assertActorMembership(workspaceId, requestedBy);

        const assignees = await this.stickyNoteAssigneeRepository.findActiveByStickyNote(stickyNoteId);
        return assignees.map((assignee) => this.toResponse(assignee));
    }

    async getStickyNoteAssignees(
        filters: IStickyNoteAssigneeFilter = {},
        requestedBy: string,
    ): Promise<IStickyNoteAssigneePaginatedResult> {
        let workspaceId = filters.workspaceId ? String(filters.workspaceId) : "";

        if (filters.stickyNoteId) {
            const stickyNote = await this.getAssignmentTarget(String(filters.stickyNoteId), false);

            const noteWorkspaceId = stickyNote.workspaceId.toString();

            if (workspaceId && workspaceId !== noteWorkspaceId) {
                throw new AppError(StickyNoteAssigneeMessages.WORKSPACE_MISMATCH, 400);
            }

            workspaceId = noteWorkspaceId;
        }

        if (!workspaceId) {
            throw new AppError(StickyNoteAssigneeMessages.SCOPE_REQUIRED, 400);
        }

        await this.assertActorMembership(workspaceId, requestedBy);

        const normalizedFilters: IStickyNoteAssigneeFilter = {
            workspaceId,
            stickyNoteId: filters.stickyNoteId,
            userId: filters.userId,
            status: filters.status ?? StickyNoteAssigneeStatus.ACTIVE,
            page: Math.max(filters.page ?? STICKY_NOTE_ASSIGNEE_CONSTANTS.PAGINATION.DEFAULT_PAGE, 1),
            limit: Math.min(
                Math.max(filters.limit ?? STICKY_NOTE_ASSIGNEE_CONSTANTS.PAGINATION.DEFAULT_LIMIT, 1),
                STICKY_NOTE_ASSIGNEE_CONSTANTS.PAGINATION.MAX_LIMIT,
            ),
            sortBy: filters.sortBy ?? "assignedAt",
            sortOrder: filters.sortOrder ?? "desc",
        };

        const result = await this.stickyNoteAssigneeRepository.findAll(normalizedFilters);

        return {
            data: result.data.map((item) => this.toResponse(item)),
            pagination: result.pagination,
        };
    }

    async syncStickyNoteAssignees(
        stickyNoteId: string,
        data: IStickyNoteAssigneeSync,
        actorId: string,
        context?: IAuditLogContext,
    ): Promise<IStickyNoteAssigneeResponse[]> {
        const requestedUserIds = StickyNoteAssigneeValidation.normalizeUniqueObjectIds(data.assigneeIds);

        if (requestedUserIds.length > STICKY_NOTE_ASSIGNEE_CONSTANTS.MAX_PER_NOTE) {
            throw new AppError(StickyNoteAssigneeMessages.TOO_MANY_ASSIGNEES, 400);
        }

        const stickyNote = await this.getAssignmentTarget(stickyNoteId, true);
        const workspaceId = stickyNote.workspaceId.toString();

        const [currentUserIds] = await Promise.all([
            this.stickyNoteAssigneeRepository.findActiveUserIdsByStickyNote(stickyNoteId),
            this.assertAssignmentMembers(workspaceId, actorId, requestedUserIds),
        ]);

        const currentSet = new Set(currentUserIds);
        const requestedSet = new Set(requestedUserIds);

        const addUserIds = requestedUserIds.filter((userId) => !currentSet.has(userId));
        if (addUserIds.length)
            await subscriptionEntitlementService.assertWorkspaceFeature(
                workspaceId,
                FeatureCode.SHARED_NOTES,
            );
        const removeUserIds = currentUserIds.filter((userId) => !requestedSet.has(userId));

        if (addUserIds.length === 0 && removeUserIds.length === 0) {
            const active = await this.stickyNoteAssigneeRepository.findActiveByStickyNote(stickyNoteId);
            return active.map((a) => this.toResponse(a));
        }

        await this.stickyNoteAssigneeRepository.syncActiveAssignments({
            workspaceId,
            stickyNoteId,
            addUserIds,
            removeUserIds,
            actorId,
        });

        await this.logAssignmentChange(stickyNote, context, currentUserIds, requestedUserIds, removeUserIds);

        const active = await this.stickyNoteAssigneeRepository.findActiveByStickyNote(stickyNoteId);
        return active.map((a) => this.toResponse(a));
    }

    async removeStickyNoteAssignee(
        id: string,
        removedBy: string,
        context?: IAuditLogContext,
    ): Promise<IStickyNoteAssigneeResponse> {
        const assignee = await this.stickyNoteAssigneeRepository.findById(id);

        if (!assignee) {
            throw new AppError(StickyNoteAssigneeMessages.NOT_FOUND, 404);
        }

        if (assignee.status === StickyNoteAssigneeStatus.REMOVED) {
            await this.assertActorMembership(this.getReferenceId(assignee.workspaceId), removedBy);
            return this.toResponse(assignee);
        }

        const stickyNoteId = this.getReferenceId(assignee.stickyNoteId);
        const stickyNote = await this.getAssignmentTarget(stickyNoteId, true);
        const workspaceId = stickyNote.workspaceId.toString();

        await this.assertActorMembership(workspaceId, removedBy);

        const removedAssignee = await this.stickyNoteAssigneeRepository.removeById(id, removedBy);

        if (!removedAssignee) {
            throw new AppError(StickyNoteAssigneeMessages.NOT_FOUND, 404);
        }

        const targetUserId = this.getReferenceId(assignee.userId);

        await this.auditLogService.log({
            ...context,
            action: AuditLogAction.REMOVE,
            module: AppModule.STICKY_NOTE_ASSIGNEE,
            resourceId: removedAssignee._id.toString(),
            resourceName: "Sticky Note Assignee",
            description: `User "${targetUserId}" was removed from sticky note "${stickyNote.title || stickyNoteId}".`,
        });

        await this.logAssignmentChange(stickyNote, context, [targetUserId], [], [targetUserId]);

        return this.toResponse(removedAssignee);
    }

    async restoreStickyNoteAssignee(
        id: string,
        assignedBy: string,
        context?: IAuditLogContext,
    ): Promise<IStickyNoteAssigneeResponse> {
        const assignee = await this.stickyNoteAssigneeRepository.findById(id);

        if (!assignee) {
            throw new AppError(StickyNoteAssigneeMessages.NOT_FOUND, 404);
        }

        if (assignee.status === StickyNoteAssigneeStatus.ACTIVE) {
            await this.assertActorMembership(this.getReferenceId(assignee.workspaceId), assignedBy);
            return this.toResponse(assignee);
        }

        const stickyNoteId = this.getReferenceId(assignee.stickyNoteId);
        const stickyNote = await this.getAssignmentTarget(stickyNoteId, true);
        const workspaceId = stickyNote.workspaceId.toString();
        await subscriptionEntitlementService.assertWorkspaceFeature(workspaceId, FeatureCode.SHARED_NOTES);
        const userId = this.getReferenceId(assignee.userId);

        const [activeCount] = await Promise.all([
            this.stickyNoteAssigneeRepository.countActiveByStickyNote(stickyNoteId),
            this.assertAssignmentMembers(workspaceId, assignedBy, [userId]),
        ]);

        if (activeCount >= STICKY_NOTE_ASSIGNEE_CONSTANTS.MAX_PER_NOTE) {
            throw new AppError(StickyNoteAssigneeMessages.MAX_ASSIGNEES_REACHED, 400);
        }

        const restoredAssignee = await this.stickyNoteAssigneeRepository.restoreById(id, assignedBy);

        if (!restoredAssignee) {
            throw new AppError(StickyNoteAssigneeMessages.NOT_FOUND, 404);
        }

        await this.auditLogService.log({
            ...context,
            action: AuditLogAction.RESTORE,
            module: AppModule.STICKY_NOTE_ASSIGNEE,
            resourceId: restoredAssignee._id.toString(),
            resourceName: "Sticky Note Assignee",
            description: `Assignment of user "${userId}" to sticky note "${stickyNote.title || stickyNoteId}" was restored successfully.`,
        });

        await this.logAssignmentChange(stickyNote, context, [], [userId], []);

        return this.toResponse(restoredAssignee);
    }

    async removeAssignmentsForWorkspaceMember(workspaceId: string, userId: string, removedBy: string) {
        return this.stickyNoteAssigneeRepository.removeAllByWorkspaceAndUser(workspaceId, userId, removedBy);
    }

    private async getAssignmentTarget(
        stickyNoteId: string,
        requireActive: boolean,
    ): Promise<IStickyNoteAssignmentTarget> {
        const stickyNote = await StickyNoteModel.findOne({
            _id: new Types.ObjectId(stickyNoteId),
            ...(requireActive
                ? { status: StickyNoteStatus.ACTIVE }
                : { status: { $ne: StickyNoteStatus.TRASHED } }),
        })
            .select({
                _id: 1,
                workspaceId: 1,
                title: 1,
                status: 1,
            })
            .lean()
            .exec();

        if (!stickyNote) {
            throw new AppError(
                requireActive
                    ? StickyNoteAssigneeMessages.STICKY_NOTE_NOT_ACTIVE
                    : StickyNoteAssigneeMessages.STICKY_NOTE_NOT_FOUND,
                requireActive ? 400 : 404,
            );
        }

        return stickyNote as IStickyNoteAssignmentTarget;
    }

    private async assertActorMembership(workspaceId: string, actorId: string): Promise<void> {
        const workspace = await WorkspaceModel.findById(workspaceId)
            .select("_id ownerId createdBy status")
            .lean();

        if (!workspace || isWorkspaceTrashed(workspace.status)) {
            throw new AppError(StickyNoteAssigneeMessages.STICKY_NOTE_NOT_FOUND, 404);
        }

        const isOwnerOrCreator =
            workspace.ownerId?.toString() === actorId || workspace.createdBy?.toString() === actorId;

        if (!isOwnerOrCreator) {
            const actor = await WorkspaceMemberModel.findOne({
                workspaceId: new Types.ObjectId(workspaceId),
                userId: new Types.ObjectId(actorId),
                status: WorkspaceMemberStatus.ACTIVE,
            })
                .select({ _id: 1 })
                .lean()
                .exec();

            if (!actor) {
                throw new AppError(StickyNoteAssigneeMessages.ACTOR_NOT_ACTIVE_MEMBER, 403);
            }
        }
    }

    private async assertAssignmentMembers(
        workspaceId: string,
        actorId: string,
        targetUserIds: readonly string[],
    ): Promise<void> {
        const allUserIds = [...new Set([actorId, ...targetUserIds])];

        const existingUsers = await UserModel.find({
            _id: {
                $in: allUserIds.map((id) => new Types.ObjectId(id)),
            },
        })
            .select({ _id: 1 })
            .lean();

        const existingUserIds = new Set(existingUsers.map((u) => u._id.toString()));

        for (const targetId of targetUserIds) {
            if (!existingUserIds.has(targetId)) {
                throw new AppError(StickyNoteAssigneeMessages.USER_NOT_FOUND, 404);
            }
        }

        const workspace = await WorkspaceModel.findById(workspaceId)
            .select("_id ownerId createdBy status")
            .lean();

        if (!workspace || isWorkspaceTrashed(workspace.status)) {
            throw new AppError(StickyNoteAssigneeMessages.STICKY_NOTE_NOT_FOUND, 404);
        }

        const ownerIdStr = workspace.ownerId?.toString();
        const createdByIdStr = workspace.createdBy?.toString();

        const members = await WorkspaceMemberModel.find({
            workspaceId: new Types.ObjectId(workspaceId),
            userId: {
                $in: allUserIds.map((userId) => new Types.ObjectId(userId)),
            },
            status: WorkspaceMemberStatus.ACTIVE,
        })
            .select({
                _id: 0,
                userId: 1,
            })
            .lean<IActiveWorkspaceMemberLean[]>()
            .exec();

        const activeMemberIds = new Set(members.map((member) => member.userId.toString()));
        if (ownerIdStr) activeMemberIds.add(ownerIdStr);
        if (createdByIdStr) activeMemberIds.add(createdByIdStr);

        if (!activeMemberIds.has(actorId)) {
            throw new AppError(StickyNoteAssigneeMessages.ACTOR_NOT_ACTIVE_MEMBER, 403);
        }

        const hasInvalidTarget = targetUserIds.some((userId) => !activeMemberIds.has(userId));

        if (hasInvalidTarget) {
            throw new AppError(StickyNoteAssigneeMessages.USER_NOT_ACTIVE_MEMBER, 400);
        }
    }

    private async logAssignmentChange(
        stickyNote: IStickyNoteAssignmentTarget,
        context: IAuditLogContext | undefined,
        oldUserIds: readonly string[],
        newUserIds: readonly string[],
        removedUserIds: readonly string[],
    ): Promise<void> {
        await this.auditLogService.logUpdate(
            context ?? {},
            {
                module: AppModule.STICKY_NOTE,
                resourceId: stickyNote._id.toString(),
                resourceName: stickyNote.title || "Sticky Note",
            },
            `Sticky note "${stickyNote.title || stickyNote._id.toString()}" assignees were updated successfully.`,
            [
                {
                    field: "assignees",
                    oldValue: oldUserIds,
                    newValue: newUserIds,
                },
                ...(removedUserIds.length > 0
                    ? [
                          {
                              field: "removedAssignees",
                              oldValue: [],
                              newValue: removedUserIds,
                          },
                      ]
                    : []),
            ],
        );
    }

    private toResponse(assignee: any): IStickyNoteAssigneeResponse {
        if (!assignee) return null as any;

        const id = assignee._id ? assignee._id.toString() : assignee.id;

        return {
            id,
            _id: id,
            workspaceId: assignee.workspaceId,
            stickyNoteId: assignee.stickyNoteId,
            userId: assignee.userId,
            status: assignee.status,
            assignedBy: assignee.assignedBy,
            removedBy: assignee.removedBy ?? null,
            assignedAt: assignee.assignedAt,
            removedAt: assignee.removedAt ?? null,
            createdAt: assignee.createdAt,
            updatedAt: assignee.updatedAt,
        };
    }

    private getReferenceId(value: unknown): string {
        if (!value) {
            return "";
        }

        if (value instanceof Types.ObjectId) {
            return value.toString();
        }

        if (typeof value === "string") {
            return value;
        }

        if (typeof value === "object") {
            const record = value as Record<string, unknown>;
            const id = record["_id"] ?? record["id"];
            return id ? String(id) : "";
        }

        return "";
    }
}
