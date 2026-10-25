import { Types } from "mongoose";
import { WorkspaceService } from "../../workspace/services/workspace.service.js";
import { WorkspaceRepository } from "../../workspace/repositories/workspace.repository.js";
import { WorkspaceVisibility } from "../../workspace/constants/workspace.enums.js";
import { WorkspaceMessages } from "../../workspace/constants/workspace.messages.js";
import type { IAuditLogContext } from "../../auditlog/interfaces/auditLog.interface.js";
import type { IUserDocument } from "../../user/interfaces/user.interface.js";
import { USER_WORKSPACE_CONSTANTS } from "../../user/constants/userWorkspace.constants.js";
import { WorkspaceFolderRepository } from "../../workspaceFolders/repositories/workspaceFolder.repository.js";
import { WorkspaceFolderService } from "../../workspaceFolders/services/workspaceFolder.service.js";
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
