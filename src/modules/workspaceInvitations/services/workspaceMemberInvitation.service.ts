import {
    permissionAuthorizationService,
    type IWorkspaceAuthorizationContext,
} from "../../permissions/services/permissionAuthorization.service.js";
import { PermissionAction } from "../../permissions/constants/permission.enums.js";
import { WorkspaceStatus } from "../../workspace/constants/workspace.enums.js";
import {
    invitationCreateSchema,
    invitationUpdateSchema,
    invitationListSchema,
} from "../validations/workspaceMemberInvitation.schema.js";
import crypto from "crypto";
import { Types, type ClientSession } from "mongoose";
import dotenv from "dotenv";

import { WorkspaceMemberInvitationRepository } from "../repositories/workspaceMemberInvitation.repository.js";
import { WorkspaceRepository } from "../../workspace/repositories/workspace.repository.js";

import type {
    IWorkspaceMemberInvitation,
    IWorkspaceMemberInvitationCreate,
    IWorkspaceMemberInvitationCreateItem,
    IWorkspaceMemberInvitationCreateResult,
    IWorkspaceMemberInvitationFilter,
    IWorkspaceMemberInvitationSkipped,
    IWorkspaceMemberInvitationUpdate,
    IWorkspaceMemberInvitationPreview,
    IWorkspaceMemberInvitationAcceptResult,
    WorkspaceMemberInvitationSkipCode,
} from "../interfaces/workspaceMemberInvitation.interface.js";

import { WorkspaceInvitationStatus } from "../constants/workspaceMemberInvitation.enums.js";
import { WorkspaceMemberStatus } from "../../workspaceMember/constants/workspaceMember.enums.js";

import { WORKSPACE_MEMBER_INVITATION_CONSTANTS } from "../constants/workspaceMemberInvitation.constants.js";
import { WorkspaceMemberInvitationMessages } from "../constants/workspaceMemberInvitation.messages.js";
import { WorkspaceMemberInvitationValidation } from "../validations/workspaceMemberInvitation.validation.js";

import { RoleScope } from "../../roles/constants/role.enums.js";
import { SYSTEM_ROLE_CODES } from "../../roles/constants/role.constants.js";

import { AppError } from "../../../utils/errors/app.error.js";

import { AuditLogAction } from "../../auditlog/constants/auditLog.enums.js";
import { AuditLogService } from "../../auditlog/services/auditLog.service.js";
import type { IAuditLogContext } from "../../auditlog/interfaces/auditLog.interface.js";

import { AppModule } from "../../../utils/enums/appModule.enums.js";

import { workspaceMemberInvitationEmailTemplate } from "../../../emails/templates/workspaceMemberInvitation.template.js";
import { sendEmail } from "../../../emails/services/emailService.js";

dotenv.config();

interface PreparedInvitation {
    id: Types.ObjectId;
    email: string;
    roleId: Types.ObjectId;
    roleName: string;
    userId: Types.ObjectId | null;
    message: string | null;
    rawToken: string;
    document: Partial<IWorkspaceMemberInvitation> & {
        _id: Types.ObjectId;
    };
}

export class WorkspaceMemberInvitationService {
    private readonly invitationRepository: WorkspaceMemberInvitationRepository;

    private readonly workspaceRepository: WorkspaceRepository;

    private readonly auditLogService: AuditLogService;

    constructor() {
        this.invitationRepository = new WorkspaceMemberInvitationRepository();

        this.workspaceRepository = new WorkspaceRepository();

        this.auditLogService = new AuditLogService();
    }

    async createInvitation(
        data: IWorkspaceMemberInvitationCreate,
        invitedBy: string,
        context?: IAuditLogContext,
        authorization?: IWorkspaceAuthorizationContext,
    ): Promise<IWorkspaceMemberInvitationCreateResult> {
        data = invitationCreateSchema.parse(data);
        const auth = await this.authorizeInvitation(
            data.workspaceId.toString(),
            invitedBy,
            PermissionAction.INVITE,
            authorization,
        );
        const isBatchRequest = Array.isArray(data.invitations);

        const workspaceId = data.workspaceId.toString();

        const items = this.getCreateItems(data).map((item) => ({
            email: WorkspaceMemberInvitationValidation.normalizeEmail(item.email),
            roleId: item.roleId.toString(),
            message: item.message?.trim() || null,
        }));

        const frontendUrl = process.env.FRONTEND_URL?.trim().replace(/\/+$/, "");

        if (!frontendUrl) {
            throw new AppError(WorkspaceMemberInvitationMessages.FRONTEND_URL_NOT_CONFIGURED, 500);
        }

        const emails = items.map((item) => item.email);

        const roleIds = [...new Set(items.map((item) => item.roleId))];

        const [workspace, users, roles] = await Promise.all([
            this.workspaceRepository.findById(workspaceId),
            this.invitationRepository.findUsersByEmails(emails),
            this.invitationRepository.findRolesByIds(roleIds),
        ]);

        this.assertWorkspaceEligible(workspace);

        const ownerId = this.extractObjectId(workspace.ownerId);

        const userByEmail = new Map(users.map((user) => [user.email.trim().toLowerCase(), user]));

        const roleById = new Map(roles.map((role) => [role._id.toString(), role]));

        const registeredUserIds = users.map((user) => user._id);

        const now = new Date();

        const [memberships] = await Promise.all([
            this.invitationRepository.findMemberships(workspaceId, registeredUserIds),
            this.invitationRepository.expirePendingByWorkspaceAndEmails(workspaceId, emails, now),
        ]);

        const membershipByUserId = new Map(memberships.map((membership) => [membership.userId.toString(), membership]));

        const skipped: IWorkspaceMemberInvitationSkipped[] = [];

        const prepared: PreparedInvitation[] = [];

        for (const item of items) {
            const user = userByEmail.get(item.email);

            if (user && user._id.toString() === invitedBy) {
                this.addSkipOrThrow(
                    skipped,
                    isBatchRequest,
                    item.email,
                    "SELF",
                    WorkspaceMemberInvitationMessages.CANNOT_INVITE_SELF,
                    400,
                );
                continue;
            }

            if (user && user._id.toString() === ownerId) {
                this.addSkipOrThrow(
                    skipped,
                    isBatchRequest,
                    item.email,
                    "OWNER",
                    WorkspaceMemberInvitationMessages.CANNOT_INVITE_OWNER,
                    400,
                );
                continue;
            }

            if (user) {
                const membership = membershipByUserId.get(user._id.toString());

                if (membership && membership.status !== WorkspaceMemberStatus.REMOVED) {
                    this.addSkipOrThrow(
                        skipped,
                        isBatchRequest,
                        item.email,
                        "EXISTING_MEMBER",
                        WorkspaceMemberInvitationMessages.CANNOT_INVITE_EXISTING_MEMBER,
                        409,
                    );
                    continue;
                }
            }

            const role = roleById.get(item.roleId);

            if (!role) {
                this.addSkipOrThrow(
                    skipped,
                    isBatchRequest,
                    item.email,
                    "ROLE_NOT_FOUND",
                    WorkspaceMemberInvitationMessages.ROLE_NOT_FOUND,
                    404,
                );
                continue;
            }

            if (!this.isAssignableWorkspaceRole(role, workspaceId)) {
                this.addSkipOrThrow(
                    skipped,
                    isBatchRequest,
                    item.email,
                    "ROLE_NOT_ALLOWED",
                    WorkspaceMemberInvitationMessages.ROLE_NOT_ALLOWED,
                    400,
                );
                continue;
            }

            try {
                permissionAuthorizationService.assertCanAssignRole(auth, role);
            } catch (error) {
                if (!(error instanceof AppError)) throw error;
                this.addSkipOrThrow(skipped, isBatchRequest, item.email, "ROLE_NOT_ALLOWED", error.message, 403);
                continue;
            }
            const id = new Types.ObjectId();

            const rawToken = crypto.randomBytes(WORKSPACE_MEMBER_INVITATION_CONSTANTS.TOKEN.RAW_BYTES).toString("hex");

            const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

            const expiresAt = new Date(now);

            expiresAt.setUTCDate(expiresAt.getUTCDate() + WORKSPACE_MEMBER_INVITATION_CONSTANTS.DEFAULT_EXPIRY_DAYS);

            const userId = user?._id ?? null;

            prepared.push({
                id,
                email: item.email,
                roleId: role._id,
                roleName: role.displayName || role.name,
                userId,
                message: item.message,
                rawToken,
                document: {
                    _id: id,
                    workspaceId: new Types.ObjectId(workspaceId),
                    userId,
                    email: item.email,
                    roleId: role._id,
                    invitedBy: new Types.ObjectId(invitedBy),
                    tokenHash,
                    status: WorkspaceInvitationStatus.PENDING,
                    message: item.message,
                    expiresAt,
                    acceptedAt: null,
                    rejectedAt: null,
                    cancelledAt: null,
                    createdBy: new Types.ObjectId(invitedBy),
                    updatedBy: new Types.ObjectId(invitedBy),
                    createdAt: now,
                    updatedAt: now,
                },
            });
        }

        const createdInvitations = await this.invitationRepository.runInTransaction(async (session) => {
            const created = await this.invitationRepository.createPendingBatchIfMissing(
                prepared.map((item) => item.document),
                session,
            );
            await this.auditLogService.logMany(
                created.map((invitation) => ({
                    ...context,
                    actorId: invitedBy,
                    action: AuditLogAction.ASSIGN,
                    module: AppModule.WORKSPACE_MEMBER,
                    resourceId: invitation._id,
                    resourceName: "Workspace Member Invitation",
                    metadata: { workspaceId, invitationId: invitation._id.toString() },
                    description: `Invitation was created for ${invitation.email} in workspace ${workspace.name}.`,
                })),
                session,
            );
            return created;
        });

        const createdIdSet = new Set(createdInvitations.map((invitation) => invitation._id.toString()));

        for (const item of prepared) {
            if (createdIdSet.has(item.id.toString())) {
                continue;
            }

            this.addSkipOrThrow(
                skipped,
                isBatchRequest,
                item.email,
                "PENDING_INVITATION",
                WorkspaceMemberInvitationMessages.INVITATION_ALREADY_EXISTS,
                409,
            );
        }

        const createdPrepared = prepared.filter((item) => createdIdSet.has(item.id.toString()));

        let emailSent = 0;
        let emailFailed = 0;

        if (createdPrepared.length > 0) {
            const profileUserIds = [
                ...new Set([
                    invitedBy,
                    ...createdPrepared.filter((item) => item.userId).map((item) => item.userId!.toString()),
                ]),
            ].map((id) => new Types.ObjectId(id));

            const profiles = await this.invitationRepository.findProfiles(profileUserIds);

            const profileByUserId = new Map(profiles.map((profile) => [profile.userId.toString(), profile]));

            const inviterName = this.profileDisplayName(profileByUserId.get(invitedBy), "A workspace member");

            const preparedById = new Map(createdPrepared.map((item) => [item.id.toString(), item]));

            const emailTasks = createdInvitations.map((invitation) => {
                const preparedItem = preparedById.get(invitation._id.toString());

                if (!preparedItem) {
                    return Promise.reject(new Error("Prepared invitation data was not found."));
                }

                const recipientName = preparedItem.userId
                    ? this.profileDisplayName(
                          profileByUserId.get(preparedItem.userId.toString()),
                          preparedItem.email.split("@")[0],
                      )
                    : preparedItem.email.split("@")[0];

                const invitationUrl = `${frontendUrl}/workspace-invitations/accept?token=${preparedItem.rawToken}`;

                const html = workspaceMemberInvitationEmailTemplate({
                    recipientName,
                    workspaceName: workspace.name,
                    inviterName,
                    roleName: preparedItem.roleName,
                    invitationUrl,
                    expiresAt: invitation.expiresAt,
                    message: preparedItem.message,
                });

                return sendEmail({
                    to: preparedItem.email,
                    subject: `${inviterName} invited you to ${workspace.name}`,
                    html,
                });
            });

            const emailResults = await Promise.allSettled(emailTasks);

            emailSent = emailResults.filter((result) => result.status === "fulfilled").length;

            emailFailed = emailResults.length - emailSent;
        }

        return {
            invitations: createdInvitations.map((invitation) => this.toSafeInvitation(invitation)),
            skipped,
            summary: {
                requested: items.length,
                created: createdInvitations.length,
                skipped: skipped.length,
                emailSent,
                emailFailed,
            },
        };
    }

    async validateInvitationToken(rawToken: string): Promise<IWorkspaceMemberInvitationPreview> {
        const { tokenHash } = this.prepareInvitationToken(rawToken);

        const invitation = await this.invitationRepository.findByTokenHash(tokenHash);

        if (!invitation) {
            throw new AppError(WorkspaceMemberInvitationMessages.INVALID_INVITATION_TOKEN, 400);
        }

        if (invitation.status !== WorkspaceInvitationStatus.PENDING) {
            this.throwInvitationStatusError(invitation.status);
        }

        const now = new Date();

        if (invitation.expiresAt.getTime() <= now.getTime()) {
            await this.invitationRepository.expirePendingByTokenHash(tokenHash, now);

            throw new AppError(WorkspaceMemberInvitationMessages.INVITATION_EXPIRED, 410);
        }

        const workspaceId = this.extractObjectId(invitation.workspaceId);

        const roleId = this.extractObjectId(invitation.roleId);

        const invitedById = this.extractObjectId(invitation.invitedBy);

        const normalizedEmail = WorkspaceMemberInvitationValidation.normalizeEmail(invitation.email);

        const [workspace, role, existingUser, inviterProfile] = await Promise.all([
            this.workspaceRepository.findById(workspaceId),
            this.getAssignableWorkspaceRole(roleId, workspaceId),
            this.invitationRepository.findUserByEmail(normalizedEmail),
            this.invitationRepository.findProfile(invitedById),
        ]);

        this.assertWorkspaceEligible(workspace);

        if (existingUser) {
            const invitationUserId = invitation.userId ? this.extractObjectId(invitation.userId) : null;

            if (invitationUserId && invitationUserId !== existingUser._id.toString()) {
                throw new AppError(WorkspaceMemberInvitationMessages.INVITATION_USER_MISMATCH, 409);
            }

            if (this.extractObjectId(workspace.ownerId) === existingUser._id.toString()) {
                throw new AppError(WorkspaceMemberInvitationMessages.CANNOT_INVITE_OWNER, 409);
            }

            const existingMember = await this.invitationRepository.findMembership(workspaceId, existingUser._id);

            if (existingMember?.status === WorkspaceMemberStatus.ACTIVE) {
                throw new AppError(WorkspaceMemberInvitationMessages.CANNOT_INVITE_EXISTING_MEMBER, 409);
            }
        }

        const inviterFallback = this.extractEmail(invitation.invitedBy).split("@")[0]?.trim() || "A workspace member";

        return {
            invitationId: invitation._id.toString(),
            email: normalizedEmail,
            userExists: Boolean(existingUser),
            workspace: {
                id: workspaceId,
                name: workspace.name,
                ...(workspace.slug
                    ? {
                          slug: workspace.slug,
                      }
                    : {}),
            },
            role: {
                id: role._id.toString(),
                name: role.name,
                ...(role.displayName
                    ? {
                          displayName: role.displayName,
                      }
                    : {}),
                ...(role.code
                    ? {
                          code: role.code,
                      }
                    : {}),
            },
            invitedBy: {
                id: invitedById,
                name: this.profileDisplayName(inviterProfile ?? undefined, inviterFallback),
            },
            message: invitation.message ?? null,
            expiresAt: invitation.expiresAt,
        };
    }

    async acceptInvitation(rawToken: string, authenticatedUserId: string, context?: IAuditLogContext) {
        return this.invitationRepository.runInTransaction((session) =>
            this.acceptInTransaction(rawToken, authenticatedUserId, context, session),
        );
    }

    private async acceptInTransaction(
        rawToken: string,
        authenticatedUserId: string,
        context: IAuditLogContext | undefined,
        session: ClientSession,
    ) {
        const { tokenHash } = this.prepareInvitationToken(rawToken);

        if (!WorkspaceMemberInvitationValidation.isValidObjectId(authenticatedUserId)) {
            throw new AppError(WorkspaceMemberInvitationMessages.INVALID_USER_ID, 401);
        }

        const invitation = await this.invitationRepository.findTokenForAcceptance(tokenHash, session);
        const user = await this.invitationRepository.findUserById(authenticatedUserId, session);

        if (!invitation) {
            throw new AppError(WorkspaceMemberInvitationMessages.INVALID_INVITATION_TOKEN, 400);
        }

        if (!user) {
            throw new AppError(WorkspaceMemberInvitationMessages.USER_NOT_FOUND, 404);
        }

        const normalizedUserEmail = WorkspaceMemberInvitationValidation.normalizeEmail(user.email);

        const normalizedInvitationEmail = WorkspaceMemberInvitationValidation.normalizeEmail(invitation.email);

        if (normalizedUserEmail !== normalizedInvitationEmail) {
            throw new AppError(WorkspaceMemberInvitationMessages.INVITATION_EMAIL_MISMATCH, 403);
        }

        const originalInvitationUserId = invitation.userId
            ? new Types.ObjectId(this.extractObjectId(invitation.userId))
            : null;

        if (originalInvitationUserId && originalInvitationUserId.toString() !== user._id.toString()) {
            throw new AppError(WorkspaceMemberInvitationMessages.INVITATION_USER_MISMATCH, 403);
        }

        if (invitation.status !== WorkspaceInvitationStatus.PENDING) {
            this.throwInvitationStatusError(invitation.status);
        }

        const now = new Date();

        if (invitation.expiresAt.getTime() <= now.getTime()) {
            throw new AppError(WorkspaceMemberInvitationMessages.INVITATION_EXPIRED, 410);
        }

        const workspaceId = this.extractObjectId(invitation.workspaceId);

        const roleId = this.extractObjectId(invitation.roleId);

        const invitedById = this.extractObjectId(invitation.invitedBy);

        const workspace = await this.invitationRepository.findWorkspace(workspaceId, session);
        const role = await this.getAssignableWorkspaceRole(roleId, workspaceId, session);
        const existingMember = await this.invitationRepository.findMembership(workspaceId, user._id, session);

        this.assertWorkspaceEligible(workspace);

        if (this.extractObjectId(workspace.ownerId) === user._id.toString()) {
            throw new AppError(WorkspaceMemberInvitationMessages.CANNOT_INVITE_OWNER, 409);
        }

        if (existingMember?.status === WorkspaceMemberStatus.ACTIVE) {
            throw new AppError(WorkspaceMemberInvitationMessages.CANNOT_INVITE_EXISTING_MEMBER, 409);
        }

        const acceptedInvitation = await this.invitationRepository.acceptPendingByTokenHash(
            tokenHash,
            user._id,
            now,
            session,
            invitation.roleId.toString(),
        );

        if (!acceptedInvitation) {
            throw new AppError(WorkspaceMemberInvitationMessages.INVITATION_NOT_PENDING, 409);
        }

        const member = await this.invitationRepository.activateMembership(
            {
                workspaceId: new Types.ObjectId(workspaceId),
                userId: user._id,
                roleId: role._id,
                status: WorkspaceMemberStatus.ACTIVE,
                invitedBy: new Types.ObjectId(invitedById),
                joinedAt: now,
                updatedBy: user._id,
            },
            existingMember,
            session,
        );
        if (!member) throw new AppError(WorkspaceMemberInvitationMessages.CANNOT_INVITE_EXISTING_MEMBER, 409);
        await this.auditLogService.logMany(
            [
                {
                    ...context,
                    actorId: authenticatedUserId,
                    action: AuditLogAction.ASSIGN,
                    module: AppModule.WORKSPACE_MEMBER,
                    resourceId: member._id,
                    resourceName: "Workspace Member",
                    metadata: { workspaceId, invitationId: invitation._id.toString(), memberId: member._id.toString() },
                    changes: [
                        {
                            field: "status",
                            oldValue: WorkspaceInvitationStatus.PENDING,
                            newValue: WorkspaceInvitationStatus.ACCEPTED,
                        },
                    ],
                    description: `User accepted an invitation to workspace ${workspace.name}.`,
                },
            ],
            session,
        );
        const result: IWorkspaceMemberInvitationAcceptResult = {
            invitationId: acceptedInvitation._id.toString(),
            workspaceId,
            workspaceName: workspace.name,
            memberId: member._id.toString(),
            roleName: role.displayName?.trim() || role.name,
            acceptedAt: acceptedInvitation.acceptedAt ?? now,
        };

        return result;
    }

    async getInvitationById(
        id: string,
        userId: string,
        authorization?: IWorkspaceAuthorizationContext,
        target?: Awaited<ReturnType<WorkspaceMemberInvitationRepository["findById"]>>,
    ) {
        this.assertId(id);
        const invitation = target?._id.toString() === id ? target : await this.invitationRepository.findById(id);

        if (!invitation) {
            throw new AppError(WorkspaceMemberInvitationMessages.NOT_FOUND, 404);
        }

        await this.authorizeInvitation(
            this.extractObjectId(invitation.workspaceId),
            userId,
            PermissionAction.READ,
            authorization,
        );
        return invitation;
    }

    async getInvitations(
        filters: IWorkspaceMemberInvitationFilter = {},
        userId: string,
        authorization?: IWorkspaceAuthorizationContext,
    ) {
        const parsed = invitationListSchema.parse(filters);
        if (parsed.workspaceId) {
            await this.authorizeInvitation(parsed.workspaceId, userId, PermissionAction.READ, authorization);
            return this.invitationRepository.findAll(parsed);
        }
        if (!Types.ObjectId.isValid(userId)) throw new AppError(WorkspaceMemberInvitationMessages.INVALID_USER_ID, 401);
        const workspaceIds = await this.invitationRepository.findReadableWorkspaceIds(userId);
        return this.invitationRepository.findAll(parsed, workspaceIds);
    }

    async updateInvitation(
        id: string,
        data: IWorkspaceMemberInvitationUpdate,
        updatedBy: string,
        context?: IAuditLogContext,
        authorization?: IWorkspaceAuthorizationContext,
        target?: Awaited<ReturnType<WorkspaceMemberInvitationRepository["findByIdForMutation"]>>,
    ) {
        this.assertId(id);
        data = invitationUpdateSchema.parse(data);
        const invitation =
            target?._id.toString() === id ? target : await this.invitationRepository.findByIdForMutation(id);

        if (!invitation) {
            throw new AppError(WorkspaceMemberInvitationMessages.NOT_FOUND, 404);
        }

        const auth = await this.authorizeInvitation(
            invitation.workspaceId.toString(),
            updatedBy,
            PermissionAction.ASSIGN,
            authorization,
        );

        if (invitation.status !== WorkspaceInvitationStatus.PENDING) {
            throw new AppError(WorkspaceMemberInvitationMessages.INVITATION_NOT_PENDING, 400);
        }

        if (invitation.expiresAt.getTime() <= Date.now()) {
            const expiredInvitation = await this.invitationRepository.expirePendingById(
                id,
                new Types.ObjectId(updatedBy),
                new Date(),
            );

            if (!expiredInvitation) {
                throw new AppError(WorkspaceMemberInvitationMessages.INVITATION_NOT_PENDING, 409);
            }

            throw new AppError(WorkspaceMemberInvitationMessages.INVITATION_EXPIRED, 400);
        }

        const workspaceId = invitation.workspaceId.toString();

        const updateData: Partial<IWorkspaceMemberInvitation> = {
            updatedBy: new Types.ObjectId(updatedBy),
        };

        if (data.roleId !== undefined) {
            const role = await this.getAssignableWorkspaceRole(data.roleId.toString(), workspaceId);

            permissionAuthorizationService.assertCanAssignRole(auth, role);
            updateData.roleId = role._id;
        }

        if (data.message !== undefined) {
            updateData.message = data.message?.trim() || null;
        }

        if (data.expiresAt !== undefined) {
            const expiresAt = new Date(data.expiresAt);

            if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) {
                throw new AppError(WorkspaceMemberInvitationMessages.INVALID_EXPIRY_DATE, 400);
            }

            updateData.expiresAt = expiresAt;
        }

        return this.invitationRepository.runInTransaction(async (session) => {
            const updatedInvitation = await this.invitationRepository.updatePendingById(
                id,
                updateData,
                session,
                invitation.updatedAt,
            );

            if (!updatedInvitation) {
                throw new AppError(WorkspaceMemberInvitationMessages.INVITATION_NOT_PENDING, 409);
            }

            await this.auditLogService.logMany(
                [
                    {
                        ...context,
                        actorId: updatedBy,
                        metadata: { workspaceId: invitation.workspaceId.toString(), invitationId: id },
                        changes: Object.entries(updateData)
                            .filter(([field]) => field !== "updatedBy")
                            .map(([field, newValue]) => ({
                                field,
                                oldValue: invitation[field as keyof typeof invitation],
                                newValue,
                            })),
                        action: AuditLogAction.UPDATE,
                        module: AppModule.WORKSPACE_MEMBER,
                        resourceId: invitation._id,
                        resourceName: "Workspace Member Invitation",
                        description: `Workspace invitation for ${invitation.email} was updated.`,
                    },
                ],
                session,
            );

            return updatedInvitation;
        });
    }

    async cancelInvitation(
        id: string,
        updatedBy: string,
        context?: IAuditLogContext,
        authorization?: IWorkspaceAuthorizationContext,
        target?: Awaited<ReturnType<WorkspaceMemberInvitationRepository["findByIdForMutation"]>>,
    ) {
        this.assertId(id);
        const invitation =
            target?._id.toString() === id ? target : await this.invitationRepository.findByIdForMutation(id);

        if (!invitation) {
            throw new AppError(WorkspaceMemberInvitationMessages.NOT_FOUND, 404);
        }

        await this.authorizeInvitation(
            invitation.workspaceId.toString(),
            updatedBy,
            PermissionAction.REMOVE,
            authorization,
        );

        if (invitation.status !== WorkspaceInvitationStatus.PENDING) {
            throw new AppError(WorkspaceMemberInvitationMessages.INVITATION_NOT_PENDING, 400);
        }

        if (invitation.expiresAt.getTime() <= Date.now()) {
            const expiredInvitation = await this.invitationRepository.expirePendingById(
                id,
                new Types.ObjectId(updatedBy),
                new Date(),
            );

            if (!expiredInvitation) {
                throw new AppError(WorkspaceMemberInvitationMessages.INVITATION_NOT_PENDING, 409);
            }

            throw new AppError(WorkspaceMemberInvitationMessages.INVITATION_EXPIRED, 400);
        }

        return this.invitationRepository.runInTransaction(async (session) => {
            const cancelledAt = new Date();

            const cancelledInvitation = await this.invitationRepository.cancelPendingById(
                id,
                new Types.ObjectId(updatedBy),
                cancelledAt,
                session,
            );

            if (!cancelledInvitation) {
                throw new AppError(WorkspaceMemberInvitationMessages.INVITATION_NOT_PENDING, 409);
            }

            await this.auditLogService.logMany(
                [
                    {
                        ...context,
                        actorId: updatedBy,
                        metadata: { workspaceId: invitation.workspaceId.toString(), invitationId: id },
                        changes: [
                            {
                                field: "status",
                                oldValue: invitation.status,
                                newValue: WorkspaceInvitationStatus.CANCELLED,
                            },
                        ],
                        action: AuditLogAction.REMOVE,
                        module: AppModule.WORKSPACE_MEMBER,
                        resourceId: invitation._id,
                        resourceName: "Workspace Member Invitation",
                        description: `Workspace invitation for ${invitation.email} was cancelled.`,
                    },
                ],
                session,
            );

            return cancelledInvitation;
        });
    }

    private assertId(id: string): void {
        if (!Types.ObjectId.isValid(id)) throw new AppError(WorkspaceMemberInvitationMessages.NOT_FOUND, 404);
    }

    private assertWorkspaceEligible<T extends { status: WorkspaceStatus; isPersonal: boolean }>(
        workspace: T | null,
    ): asserts workspace is T {
        if (!workspace) throw new AppError(WorkspaceMemberInvitationMessages.WORKSPACE_NOT_FOUND, 404);
        permissionAuthorizationService.assertWorkspaceState(workspace.status);
        if (workspace.isPersonal) throw new AppError(WorkspaceMemberInvitationMessages.PERSONAL_WORKSPACE, 400);
    }

    private async authorizeInvitation(
        workspaceId: string,
        userId: string,
        action: PermissionAction,
        authorization?: IWorkspaceAuthorizationContext,
    ) {
        if (!Types.ObjectId.isValid(userId)) throw new AppError(WorkspaceMemberInvitationMessages.INVALID_USER_ID, 401);
        if (!Types.ObjectId.isValid(workspaceId))
            throw new AppError(WorkspaceMemberInvitationMessages.INVALID_WORKSPACE_ID, 400);
        if (authorization && (authorization.userId !== userId || authorization.workspaceId !== workspaceId)) {
            throw new AppError(WorkspaceMemberInvitationMessages.ACCESS_DENIED, 403);
        }
        const auth =
            authorization?.workspaceStatus !== undefined
                ? authorization
                : await permissionAuthorizationService.resolveWorkspaceAuthorization(userId, workspaceId);
        permissionAuthorizationService.assertWorkspaceState(auth.workspaceStatus!);
        permissionAuthorizationService.assertMemberAccess(auth, action);
        return auth;
    }

    private throwInvitationStatusError(status: WorkspaceInvitationStatus): never {
        switch (status) {
            case WorkspaceInvitationStatus.ACCEPTED:
                throw new AppError(WorkspaceMemberInvitationMessages.INVITATION_ALREADY_ACCEPTED, 409);

            case WorkspaceInvitationStatus.REJECTED:
                throw new AppError(WorkspaceMemberInvitationMessages.INVITATION_ALREADY_REJECTED, 409);

            case WorkspaceInvitationStatus.CANCELLED:
                throw new AppError(WorkspaceMemberInvitationMessages.INVITATION_ALREADY_CANCELLED, 409);

            case WorkspaceInvitationStatus.EXPIRED:
                throw new AppError(WorkspaceMemberInvitationMessages.INVITATION_EXPIRED, 410);

            default:
                throw new AppError(WorkspaceMemberInvitationMessages.INVITATION_NOT_PENDING, 409);
        }
    }

    private getCreateItems(data: IWorkspaceMemberInvitationCreate): IWorkspaceMemberInvitationCreateItem[] {
        if (Array.isArray(data.invitations)) {
            return data.invitations;
        }

        if (!data.email || !data.roleId) {
            throw new AppError(WorkspaceMemberInvitationMessages.CREATE_REQUIRED, 400);
        }

        return [
            {
                email: data.email,
                roleId: data.roleId,
                message: data.message,
            },
        ];
    }

    private addSkipOrThrow(
        skipped: IWorkspaceMemberInvitationSkipped[],
        isBatchRequest: boolean,
        email: string,
        code: WorkspaceMemberInvitationSkipCode,
        message: string,
        statusCode: number,
    ): void {
        if (!isBatchRequest) {
            throw new AppError(message, statusCode);
        }

        skipped.push({
            email,
            code,
            message,
        });
    }

    private async getAssignableWorkspaceRole(roleId: string, workspaceId: string, session?: ClientSession) {
        const role = await this.invitationRepository.findRole(roleId, session);

        if (!role) {
            throw new AppError(WorkspaceMemberInvitationMessages.ROLE_NOT_FOUND, 404);
        }

        if (!this.isAssignableWorkspaceRole(role, workspaceId)) {
            throw new AppError(WorkspaceMemberInvitationMessages.ROLE_NOT_ALLOWED, 400);
        }

        return role;
    }

    private isAssignableWorkspaceRole(
        role: {
            code?: string;
            scope?: RoleScope;
            workspaceId?: Types.ObjectId | null;
            isSystem?: boolean;
            isActive?: boolean;
        },
        workspaceId: string,
    ): boolean {
        if (!role.isActive || role.scope !== RoleScope.WORKSPACE || role.code === SYSTEM_ROLE_CODES.WORKSPACE_OWNER) {
            return false;
        }

        if (role.isSystem) {
            return role.workspaceId === null || role.workspaceId === undefined;
        }

        return Boolean(role.workspaceId && role.workspaceId.toString() === workspaceId);
    }

    private profileDisplayName(
        profile:
            | {
                  firstName?: string | null;
                  lastName?: string | null;
                  displayName?: string | null;
              }
            | undefined,
        fallback: string,
    ): string {
        const fullName = [profile?.firstName, profile?.lastName].filter(Boolean).join(" ").trim();

        return profile?.displayName?.trim() || fullName || fallback;
    }

    private toSafeInvitation(invitation: IWorkspaceMemberInvitation & { _id: Types.ObjectId }) {
        const { tokenHash: _tokenHash, ...safeInvitation } = invitation;
        return safeInvitation;
    }

    private prepareInvitationToken(rawToken: string): {
        token: string;
        tokenHash: string;
    } {
        const token = rawToken?.trim();

        const expectedTokenLength = WORKSPACE_MEMBER_INVITATION_CONSTANTS.TOKEN.RAW_BYTES * 2;

        if (!token || token.length !== expectedTokenLength || !/^[a-fA-F0-9]+$/.test(token)) {
            throw new AppError(WorkspaceMemberInvitationMessages.INVALID_INVITATION_TOKEN, 400);
        }

        return {
            token,
            tokenHash: crypto.createHash("sha256").update(token).digest("hex"),
        };
    }

    private extractEmail(value: unknown): string {
        if (value && typeof value === "object" && "email" in value) {
            const email = (
                value as {
                    email?: unknown;
                }
            ).email;

            return typeof email === "string" ? email.trim().toLowerCase() : "";
        }

        return "";
    }

    private extractObjectId(value: unknown): string {
        if (value && typeof value === "object" && "_id" in value) {
            return String(
                (
                    value as {
                        _id: unknown;
                    }
                )._id,
            );
        }

        return String(value);
    }
}
