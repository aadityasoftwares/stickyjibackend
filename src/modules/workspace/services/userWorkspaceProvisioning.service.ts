import { Types } from "mongoose";
import { WorkspaceService } from "../../workspace/services/workspace.service.js";
import { WorkspaceRepository } from "../../workspace/repositories/workspace.repository.js";
import { WorkspaceModel } from "../../workspace/models/workspace.model.js";
import { WorkspaceStatus, WorkspaceVisibility } from "../../workspace/constants/workspace.enums.js";
import { WORKSPACE_CONSTANTS } from "../../workspace/constants/workspace.constants.js";
import { WorkspaceValidation } from "../../workspace/validations/workspace.validation.js";
import type { IWorkspaceResponse } from "../../workspace/interfaces/workspace.interface.js";
import { WorkspaceMessages } from "../../workspace/constants/workspace.messages.js";
import type { IAuditLogContext } from "../../auditlog/interfaces/auditLog.interface.js";
import type { IUserDocument } from "../../user/interfaces/user.interface.js";
import { USER_WORKSPACE_CONSTANTS } from "../../user/constants/userWorkspace.constants.js";
import { WorkspaceFolderModel } from "../../workspaceFolders/models/workspaceFolder.model.js";
import { WorkspaceFolderStatus } from "../../workspaceFolders/constants/workspaceFolder.enums.js";
import { WORKSPACE_FOLDER_CONSTANTS } from "../../workspaceFolders/constants/workspaceFolder.constants.js";
import { WorkspaceFolderValidation } from "../../workspaceFolders/validations/workspaceFolder.validation.js";
import type { IWorkspaceFolderResponse } from "../../workspaceFolders/interfaces/workspaceFolder.interface.js";
import { WorkspaceFolderRepository } from "../../workspaceFolders/repositories/workspaceFolder.repository.js";
import { WorkspaceFolderService } from "../../workspaceFolders/services/workspaceFolder.service.js";
import { WorkspaceMemberModel } from "../../workspaceMember/models/workspaceMember.model.js";
import { WorkspaceMemberStatus } from "../../workspaceMember/constants/workspaceMember.enums.js";
import { StickyNoteColumnService } from "../../stickynotescolumns/services/stickyNoteColumn.service.js";
import { StickyNoteColumnType } from "../../stickynotescolumns/constants/stickyNoteColumn.enums.js";
import { StickyNoteRepository } from "../../stickynotes/repositories/stickynote.repository.js";
import {
    StickyNoteBackgroundPattern,
    StickyNoteColor,
    StickyNotePriority,
    StickyNoteShape,
    StickyNoteStatus,
    StickyNoteVariant,
} from "../../stickynotes/constants/stickyNote.enums.js";
import { UserPreferenceModel } from "../../userpreference/models/userPreference.model.js";
import { UserPreferenceValidation } from "../../userpreference/validations/userPreference.validation.js";
import { USER_PREFERENCE_KEYS } from "../../userpreference/constants/userPreference.constants.js";
import { AppError } from "../../../utils/errors/app.error.js";
import type { InitialSetupInput } from "../../onboarding/validations/initialSetup.schema.js";

export class UserWorkspaceProvisioningService {
    private readonly workspaceService: WorkspaceService;
    private readonly workspaceRepository: WorkspaceRepository;
    private readonly workspaceFolderService: WorkspaceFolderService;
    private readonly workspaceFolderRepository: WorkspaceFolderRepository;
    private readonly stickyNoteColumnService: StickyNoteColumnService;
    private readonly stickyNoteRepository: StickyNoteRepository;

    constructor() {
        this.workspaceService = new WorkspaceService();
        this.workspaceRepository = new WorkspaceRepository();
        this.workspaceFolderService = new WorkspaceFolderService();
        this.workspaceFolderRepository = new WorkspaceFolderRepository();
        this.stickyNoteColumnService = new StickyNoteColumnService();
        this.stickyNoteRepository = new StickyNoteRepository();
    }

    async getOnboardingStatus(userId: string): Promise<{
        hasWorkspaces: boolean;
        hasFolders: boolean;
        requiresOnboarding: boolean;
    }> {
        const userObjectId = new Types.ObjectId(userId);

        const [ownedWorkspaceExists, memberWorkspaceExists] = await Promise.all([
            WorkspaceModel.exists({
                ownerId: userObjectId,
                status: { $ne: WorkspaceStatus.DELETED },
            }),
            WorkspaceMemberModel.exists({
                userId: userObjectId,
                status: WorkspaceMemberStatus.ACTIVE,
            }),
        ]);

        const hasWorkspaces = Boolean(ownedWorkspaceExists || memberWorkspaceExists);

        let hasFolders = false;

        if (hasWorkspaces) {
            if (ownedWorkspaceExists) {
                const ownedWorkspaceIds = await WorkspaceModel.find({
                    ownerId: userObjectId,
                    status: { $ne: WorkspaceStatus.DELETED },
                }).distinct("_id");

                const folderExists = await WorkspaceFolderModel.exists({
                    workspaceId: { $in: ownedWorkspaceIds },
                    status: { $ne: WorkspaceFolderStatus.DELETED },
                });

                hasFolders = Boolean(folderExists);
            }

            if (!hasFolders && memberWorkspaceExists) {
                const memberWorkspaceIds = await WorkspaceMemberModel.find({
                    userId: userObjectId,
                    status: WorkspaceMemberStatus.ACTIVE,
                }).distinct("workspaceId");

                const folderExists = await WorkspaceFolderModel.exists({
                    workspaceId: { $in: memberWorkspaceIds },
                    status: { $ne: WorkspaceFolderStatus.DELETED },
                });

                hasFolders = Boolean(folderExists);
            }
        }

        const requiresOnboarding = !hasWorkspaces || !hasFolders;

        return {
            hasWorkspaces,
            hasFolders,
            requiresOnboarding,
        };
    }

    async initialSetup(
        userId: string,
        data: InitialSetupInput,
        context?: IAuditLogContext,
    ): Promise<{
        workspace: IWorkspaceResponse;
        folder: IWorkspaceFolderResponse;
    }> {
        const normalizedWorkspaceName = WorkspaceValidation.normalizeName(data.workspaceTitle);
        const normalizedFolderName = WorkspaceFolderValidation.normalizeName(data.folderTitle);

        const status = await this.getOnboardingStatus(userId);
        if (!status.requiresOnboarding) {
            throw new AppError("Onboarding initial setup has already been completed.", 409);
        }

        // Generate unique workspace slug
        let baseWorkspaceSlug = WorkspaceValidation.normalizeSlug(normalizedWorkspaceName);
        if (
            !WorkspaceValidation.isValidSlug(baseWorkspaceSlug) ||
            baseWorkspaceSlug.length < WORKSPACE_CONSTANTS.SLUG.MIN_LENGTH
        ) {
            baseWorkspaceSlug = `workspace-${userId.slice(-6)}`;
        }
        if (baseWorkspaceSlug.length > WORKSPACE_CONSTANTS.SLUG.MAX_LENGTH) {
            baseWorkspaceSlug = baseWorkspaceSlug.slice(0, WORKSPACE_CONSTANTS.SLUG.MAX_LENGTH).replace(/-+$/, "");
        }

        let workspaceSlug = baseWorkspaceSlug;
        let workspaceCounter = 1;
        while (await this.workspaceRepository.existsBySlug(workspaceSlug)) {
            const suffix = `-${workspaceCounter++}`;
            const maxBaseLen = Math.max(
                WORKSPACE_CONSTANTS.SLUG.MIN_LENGTH,
                WORKSPACE_CONSTANTS.SLUG.MAX_LENGTH - suffix.length,
            );
            workspaceSlug = `${baseWorkspaceSlug.slice(0, maxBaseLen)}${suffix}`;
        }

        // 1. Create personal workspace
        const workspace = await this.workspaceService.createPersonalWorkspace(
            {
                name: normalizedWorkspaceName,
                slug: workspaceSlug,
                description: "Your personal workspace",
                visibility: WorkspaceVisibility.PRIVATE,
            },
            userId,
            context,
        );

        const workspaceId = workspace.id;

        // Generate unique folder slug
        let baseFolderSlug = WorkspaceFolderValidation.normalizeSlug(normalizedFolderName);
        if (
            !WorkspaceFolderValidation.isValidSlug(baseFolderSlug) ||
            baseFolderSlug.length < WORKSPACE_FOLDER_CONSTANTS.SLUG.MIN_LENGTH
        ) {
            baseFolderSlug = "my-notes";
        }
        if (baseFolderSlug.length > WORKSPACE_FOLDER_CONSTANTS.SLUG.MAX_LENGTH) {
            baseFolderSlug = baseFolderSlug.slice(0, WORKSPACE_FOLDER_CONSTANTS.SLUG.MAX_LENGTH).replace(/-+$/, "");
        }

        let folderSlug = baseFolderSlug;
        let folderCounter = 1;
        while (await this.workspaceFolderRepository.existsBySlug(workspaceId, folderSlug)) {
            const suffix = `-${folderCounter++}`;
            const maxBaseLen = Math.max(
                WORKSPACE_FOLDER_CONSTANTS.SLUG.MIN_LENGTH,
                WORKSPACE_FOLDER_CONSTANTS.SLUG.MAX_LENGTH - suffix.length,
            );
            folderSlug = `${baseFolderSlug.slice(0, maxBaseLen)}${suffix}`;
        }

        // 2. Create default folder inside the newly created workspace
        let folder: IWorkspaceFolderResponse;
        try {
            folder = await this.workspaceFolderService.createDefaultWorkspaceFolder(
                {
                    workspaceId,
                    name: normalizedFolderName,
                    slug: folderSlug,
                    description: "Your default notes folder",
                    position: 0,
                    isDefault: true,
                },
                userId,
                context,
            );
        } catch (error) {
            await this.workspaceRepository.hardDeleteById(workspaceId).catch(() => {});
            throw error;
        }

        const folderId = folder.id;

        // 3. Create default sticky note columns
        const columns = await this.ensureDefaultStickyNoteColumns(workspaceId, folderId, userId);

        // 4. Create default starter note in TODO column
        if (columns?.length) {
            const todoColumn = columns.find((column) => column.type === StickyNoteColumnType.TODO);
            if (todoColumn) {
                const todoColumnId = this.resolveEntityId(todoColumn);
                if (todoColumnId) {
                    await this.ensureDefaultStickyNote(workspaceId, folderId, todoColumnId, userId);
                }
            }
        }

        // 5. Initialize user preferences with selected workspace and folder
        await this.seedInitialUserPreferences(userId, workspaceId, folderId);

        return {
            workspace,
            folder,
        };
    }

    async provisionUserDefaults(user: IUserDocument, context?: IAuditLogContext): Promise<void> {
        const userId = user._id.toString();

        try {
            const workspace = await this.ensurePersonalWorkspace(userId, context);

            if (!workspace) {
                return;
            }

            const workspaceId = this.resolveEntityId(workspace);

            if (!workspaceId) {
                this.logProvisioningError(
                    userId,
                    "Personal workspace ID could not be resolved.",
                    new Error("Workspace ID missing"),
                );
                return;
            }

            const defaultFolder = await this.ensureDefaultFolder(workspaceId, userId, context);

            if (!defaultFolder) {
                return;
            }

            const workspaceFolderId = this.resolveEntityId(defaultFolder);

            if (!workspaceFolderId) {
                this.logProvisioningError(
                    userId,
                    "Default workspace folder ID could not be resolved.",
                    new Error("Workspace folder ID missing"),
                );
                return;
            }

            const columns = await this.ensureDefaultStickyNoteColumns(workspaceId, workspaceFolderId, userId);

            if (!columns?.length) {
                return;
            }

            const todoColumn = columns.find((column) => column.type === StickyNoteColumnType.TODO);

            if (!todoColumn) {
                this.logProvisioningError(
                    userId,
                    "Default TODO sticky note column was not found.",
                    new Error("Default TODO column missing"),
                );
                return;
            }

            const todoColumnId = this.resolveEntityId(todoColumn);

            if (!todoColumnId) {
                this.logProvisioningError(
                    userId,
                    "Default TODO sticky note column ID could not be resolved.",
                    new Error("TODO column ID missing"),
                );
                return;
            }

            await this.ensureDefaultStickyNote(workspaceId, workspaceFolderId, todoColumnId, userId);
            await this.seedInitialUserPreferences(userId, workspaceId, workspaceFolderId);
        } catch (error) {
            this.logProvisioningError(userId, WorkspaceMessages.PROVISIONING.UNEXPECTED_ERROR, error);
        }
    }

    private async ensurePersonalWorkspace(userId: string, context?: IAuditLogContext) {
        let workspace: unknown = await this.workspaceRepository.findByOwnerAndPersonal(userId, true);

        if (workspace) {
            return workspace;
        }

        try {
            workspace = await this.workspaceService.createPersonalWorkspace(
                {
                    name: USER_WORKSPACE_CONSTANTS.WORKSPACE.NAME,
                    slug: this.buildWorkspaceSlug(userId),
                    description: USER_WORKSPACE_CONSTANTS.WORKSPACE.DESCRIPTION,
                    visibility: WorkspaceVisibility.PRIVATE,
                },
                userId,
                context,
            );

            return workspace;
        } catch (error) {
            try {
                workspace = await this.workspaceRepository.findByOwnerAndPersonal(userId, true);
            } catch (lookupError) {
                this.logProvisioningError(
                    userId,
                    WorkspaceMessages.PROVISIONING.WORKSPACE_VERIFY_FAILED,
                    lookupError,
                );
                return null;
            }

            if (workspace) {
                this.logProvisioningError(
                    userId,
                    WorkspaceMessages.PROVISIONING.WORKSPACE_POST_CREATE_FAILED,
                    error,
                );
                return workspace;
            }

            this.logProvisioningError(userId, WorkspaceMessages.PROVISIONING.WORKSPACE_CREATE_FAILED, error);

            return null;
        }
    }

    private async ensureDefaultFolder(workspaceId: string, userId: string, context?: IAuditLogContext) {
        let defaultFolder: unknown = await this.workspaceFolderRepository.findDefaultFolder(workspaceId);

        if (defaultFolder) {
            return defaultFolder;
        }

        try {
            defaultFolder = await this.workspaceFolderService.createDefaultWorkspaceFolder(
                {
                    workspaceId,
                    name: USER_WORKSPACE_CONSTANTS.DEFAULT_FOLDER.NAME,
                    slug: this.buildDefaultFolderSlug(userId),
                    description: USER_WORKSPACE_CONSTANTS.DEFAULT_FOLDER.DESCRIPTION,
                    position: USER_WORKSPACE_CONSTANTS.DEFAULT_FOLDER.POSITION,
                    isDefault: true,
                },
                userId,
                context,
            );

            return defaultFolder;
        } catch (error) {
            try {
                defaultFolder = await this.workspaceFolderRepository.findDefaultFolder(workspaceId);
            } catch (lookupError) {
                this.logProvisioningError(
                    userId,
                    WorkspaceMessages.PROVISIONING.DEFAULT_FOLDER_VERIFY_FAILED,
                    lookupError,
                );
                return null;
            }

            if (defaultFolder) {
                this.logProvisioningError(
                    userId,
                    WorkspaceMessages.PROVISIONING.DEFAULT_FOLDER_POST_CREATE_FAILED,
                    error,
                );
                return defaultFolder;
            }

            this.logProvisioningError(
                userId,
                WorkspaceMessages.PROVISIONING.DEFAULT_FOLDER_CREATE_FAILED,
                error,
            );

            return null;
        }
    }

    private async ensureDefaultStickyNoteColumns(
        workspaceId: string,
        workspaceFolderId: string,
        userId: string,
    ) {
        try {
            return await this.stickyNoteColumnService.createDefaultColumns(
                workspaceId,
                workspaceFolderId,
                userId,
            );
        } catch (error) {
            this.logProvisioningError(userId, "Failed to provision default sticky note columns.", error);
            return null;
        }
    }

    private async ensureDefaultStickyNote(
        workspaceId: string,
        workspaceFolderId: string,
        columnId: string,
        userId: string,
    ): Promise<unknown> {
        let defaultNote: unknown = await this.stickyNoteRepository.findByWorkspaceFolderAndTitle(
            workspaceId,
            workspaceFolderId,
            USER_WORKSPACE_CONSTANTS.DEFAULT_NOTE.TITLE,
        );

        if (defaultNote) {
            return defaultNote;
        }

        try {
            const [position, rank, stickyNoteNumber] = await Promise.all([
                this.stickyNoteRepository.getNextPositionByColumn(columnId),
                this.stickyNoteRepository.getNextRankByColumn(columnId),
                this.stickyNoteRepository.getNextStickyNoteNumber(workspaceId),
            ]);

            defaultNote = await this.stickyNoteRepository.create({
                workspaceId: new Types.ObjectId(workspaceId),
                workspaceFolderId: new Types.ObjectId(workspaceFolderId),
                columnId: new Types.ObjectId(columnId),
                stickyNoteNumber,
                title: USER_WORKSPACE_CONSTANTS.DEFAULT_NOTE.TITLE,
                content: USER_WORKSPACE_CONSTANTS.DEFAULT_NOTE.CONTENT,
                color: StickyNoteColor.YELLOW,
                priority: StickyNotePriority.NONE,
                shape: StickyNoteShape.SQUARE,
                variant: StickyNoteVariant.PLAIN,
                backgroundPattern: StickyNoteBackgroundPattern.NONE,
                position,
                rank,
                status: StickyNoteStatus.ACTIVE,
                noteDate: null,
                createdBy: new Types.ObjectId(userId),
                updatedBy: new Types.ObjectId(userId),
            });

            return defaultNote;
        } catch (error) {
            try {
                defaultNote = await this.stickyNoteRepository.findByWorkspaceFolderAndTitle(
                    workspaceId,
                    workspaceFolderId,
                    USER_WORKSPACE_CONSTANTS.DEFAULT_NOTE.TITLE,
                );
            } catch (lookupError) {
                this.logProvisioningError(
                    userId,
                    WorkspaceMessages.PROVISIONING.DEFAULT_NOTE_VERIFY_FAILED,
                    lookupError,
                );
                return null;
            }

            if (defaultNote) {
                this.logProvisioningError(
                    userId,
                    WorkspaceMessages.PROVISIONING.DEFAULT_NOTE_POST_CREATE_FAILED,
                    error,
                );
                return defaultNote;
            }

            this.logProvisioningError(
                userId,
                WorkspaceMessages.PROVISIONING.DEFAULT_NOTE_CREATE_FAILED,
                error,
            );

            return null;
        }
    }

    private async seedInitialUserPreferences(
        userId: string,
        workspaceId: string,
        workspaceFolderId: string,
    ): Promise<void> {
        try {
            const updates = [
                {
                    key: UserPreferenceValidation.getStorageKey(USER_PREFERENCE_KEYS.SELECTED_WORKSPACE_ID),
                    value: workspaceId,
                },
                {
                    key: UserPreferenceValidation.getStorageKey(USER_PREFERENCE_KEYS.SELECTED_FOLDER_ID),
                    value: workspaceFolderId,
                },
                {
                    key: UserPreferenceValidation.getStorageKey(USER_PREFERENCE_KEYS.MY_NOTES_SELECTED_WORKSPACE),
                    value: workspaceId,
                },
                {
                    key: UserPreferenceValidation.getStorageKey(USER_PREFERENCE_KEYS.MY_NOTES_SELECTED_FOLDER),
                    value: workspaceFolderId,
                },
                {
                    key: UserPreferenceValidation.getStorageKey(USER_PREFERENCE_KEYS.FAVOURITE_SELECTED_WORKSPACE),
                    value: workspaceId,
                },
            ];

            const userObjectId = new Types.ObjectId(userId);

            await UserPreferenceModel.bulkWrite(
                updates.map((pref) => ({
                    updateOne: {
                        filter: {
                            userId: userObjectId,
                            key: pref.key,
                            value: { $in: ["", null] },
                        },
                        update: {
                            $set: { value: pref.value },
                        },
                    },
                })),
                { ordered: false },
            );
        } catch (error) {
            this.logProvisioningError(userId, "Failed to initialize selected workspace/folder preferences.", error);
        }
    }

    private buildWorkspaceSlug(userId: string): string {
        return [USER_WORKSPACE_CONSTANTS.WORKSPACE.SLUG_PREFIX, userId].join("-");
    }

    private buildDefaultFolderSlug(userId: string): string {
        return [USER_WORKSPACE_CONSTANTS.DEFAULT_FOLDER.SLUG_PREFIX, userId].join("-");
    }

    private resolveEntityId(value: unknown): string {
        if (typeof value !== "object" || value === null) {
            return "";
        }

        if ("id" in value) {
            const id = (value as { id?: unknown }).id;

            if (id) {
                return String(id);
            }
        }

        if ("_id" in value) {
            const id = (value as { _id?: unknown })._id;

            if (id) {
                return String(id);
            }
        }

        return "";
    }

    private logProvisioningError(userId: string, message: string, error: unknown): void {
        console.error(`[UserWorkspaceProvisioning] ${message}`, { userId, error });
    }
}
