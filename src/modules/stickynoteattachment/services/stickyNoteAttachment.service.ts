import { MediaService } from "../../media/services/media.service.js";
import { MediaAccessService } from "../../media/services/mediaAccess.service.js";
import { MediaSecurity } from "../../media/constants/mediaSecurity.constants.js";
import { MediaPurpose, MediaResourceType, MediaVisibility } from "../../media/constants/media.enums.js";
import { PermissionAction } from "../../permissions/constants/permission.enums.js";
import { AppError } from "../../../utils/errors/app.error.js";
import { StickyNoteAttachmentRepository } from "../repositories/stickyNoteAttachment.repository.js";
import {
    attachmentListSchema,
    attachmentParamsSchema,
    attachmentUploadSchema,
} from "../validations/stickyNoteAttachment.schema.js";
import { attachmentResponse } from "../utils/attachmentResponse.js";
export { attachmentResponse } from "../utils/attachmentResponse.js";

export class StickyNoteAttachmentService {
    private readonly media = new MediaService();
    private readonly access = new MediaAccessService();
    private readonly repository = new StickyNoteAttachmentRepository();

    async requestUpload(noteId: string, userId: string, input: unknown) {
        attachmentParamsSchema.parse({ noteId });
        const data = attachmentUploadSchema.parse(input);
        const result = await this.media.requestUpload(
            {
                ...data,
                mediaType: MediaSecurity.format(data.mimeType).mediaType,
                purpose: MediaPurpose.ATTACHMENT,
                visibility: MediaVisibility.PRIVATE,
                resourceType: MediaResourceType.NOTE,
                resourceId: noteId,
            },
            userId,
        );
        return {
            ...attachmentResponse(result.media),
            uploadUrl: result.uploadUrl,
            expiresAt: result.expiresAt,
            requiredHeaders: result.requiredHeaders,
        };
    }

    private async find(noteId: string, attachmentId: string, userId: string, action: PermissionAction) {
        attachmentParamsSchema.parse({ noteId, attachmentId });
        const scope = await this.access.resolve(userId, MediaResourceType.NOTE, noteId, action);
        const media = await this.repository.find(scope, attachmentId);
        if (!media) throw new AppError("Attachment not found.", 404);
        return media;
    }
    async complete(noteId: string, attachmentId: string, userId: string) {
        await this.find(noteId, attachmentId, userId, PermissionAction.UPDATE);
        return attachmentResponse(await this.media.completeUpload(attachmentId, userId));
    }
    async list(noteId: string, userId: string, query: unknown) {
        attachmentParamsSchema.parse({ noteId });
        const { page, limit } = attachmentListSchema.parse(query);
        const scope = await this.access.resolve(userId, MediaResourceType.NOTE, noteId);
        const result = await this.repository.list(scope, page, limit);
        return { ...result, data: result.data.map(attachmentResponse) };
    }
    async download(noteId: string, attachmentId: string, userId: string) {
        await this.find(noteId, attachmentId, userId, PermissionAction.READ);
        return this.media.getDownloadUrl(attachmentId, userId);
    }
    async delete(noteId: string, attachmentId: string, userId: string) {
        await this.find(noteId, attachmentId, userId, PermissionAction.UPDATE);
        await this.media.deleteMedia(attachmentId, userId);
    }
}
