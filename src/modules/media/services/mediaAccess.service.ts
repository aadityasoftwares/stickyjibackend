import { Types } from "mongoose";
import { MediaResourceType } from "../constants/media.enums.js";
import type { IMedia } from "../interfaces/media.interface.js";
import type { MediaStorageScope } from "../storage/storageKey.builder.js";
import { WorkspaceModel } from "../../workspace/models/workspace.model.js";
import { StickyNoteModel } from "../../stickynotes/models/stickynote.model.js";
import { UserModel } from "../../user/models/user.model.js";
import { StickyNoteStatus } from "../../stickynotes/constants/stickyNote.enums.js";
import { permissionAuthorizationService } from "../../permissions/services/permissionAuthorization.service.js";
import { PermissionAction, PermissionModule } from "../../permissions/constants/permission.enums.js";
import { AppError } from "../../../utils/errors/app.error.js";

export class MediaAccessService {
    async resolve(
        userId: string,
        type?: MediaResourceType | null,
        id?: unknown,
        action = PermissionAction.READ,
    ): Promise<MediaStorageScope> {
        if (!Types.ObjectId.isValid(userId)) throw new AppError("Invalid user ID.", 400);
        if (type === MediaResourceType.NOTE || type === MediaResourceType.WORKSPACE) {
            if (!id || !Types.ObjectId.isValid(String(id))) throw new AppError("Invalid resource ID.", 400);
            const note =
                type === MediaResourceType.NOTE
                    ? await StickyNoteModel.findById(String(id)).lean().exec()
                    : null;
            if (type === MediaResourceType.NOTE && !note) throw new AppError("Note not found.", 404);
            if (note && ![StickyNoteStatus.ACTIVE, StickyNoteStatus.ARCHIVED].includes(note.status)) {
                throw new AppError("Attachments are unavailable while the note is in trash.", 409);
            }
            const workspaceId = note ? String(note.workspaceId) : String(id);
            const auth = await permissionAuthorizationService.resolveWorkspaceAuthorization(
                userId,
                workspaceId,
            );
            if (note) permissionAuthorizationService.assertNoteAccess(auth, note, action);
            else permissionAuthorizationService.assertPermission(auth, PermissionModule.WORKSPACE, action);
            const workspace = await WorkspaceModel.findById(workspaceId).select("ownerId").lean().exec();
            if (
                !workspace ||
                !(await UserModel.exists({ _id: workspace.ownerId, isDeleted: { $ne: true } }))
            ) {
                throw new AppError("Storage account not found.", 404);
            }
            return {
                accountId: String(workspace.ownerId),
                tenantId: String(workspace.ownerId),
                workspaceId,
                ...(note ? { noteId: String(note._id) } : {}),
            };
        }
        if ((type && type !== MediaResourceType.USER) || (id && String(id) !== userId)) {
            throw new AppError("Unsupported or unauthorized media resource.", 403);
        }
        return { accountId: userId };
    }

    async assertMedia(media: IMedia, userId: string, action = PermissionAction.READ) {
        const scope = await this.resolve(userId, media.resourceType, media.resourceId, action);
        if (!scope.workspaceId && String(media.uploadedBy) !== userId)
            throw new AppError("Media not found.", 404);
        if (
            (media.tenantId && String(media.tenantId) !== scope.tenantId) ||
            (media.workspaceId && String(media.workspaceId) !== scope.workspaceId) ||
            (media.storageKeyVersion === 2 && scope.workspaceId && (!media.tenantId || !media.workspaceId))
        ) {
            throw new AppError("Media ownership changed; an explicit storage transfer is required.", 409);
        }
        return scope;
    }
}
