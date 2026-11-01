import type { IMedia } from "../../media/interfaces/media.interface.js";

export const attachmentResponse = (media: IMedia) => ({
    attachmentId: String(media._id),
    mediaId: String(media._id),
    fileName: media.originalFileName,
    mimeType: media.mimeType,
    size: media.size,
    status: media.status,
    addedBy: String(media.uploadedBy),
    sortOrder: media.sortOrder ?? 0,
    uploadedAt: media.uploadedAt ?? null,
    createdAt: media.createdAt,
});

export type StickyNoteAttachmentResponse = ReturnType<typeof attachmentResponse>;
