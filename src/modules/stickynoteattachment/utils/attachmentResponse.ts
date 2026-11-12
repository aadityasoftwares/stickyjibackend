import type { IMedia } from "../../media/interfaces/media.interface.js";
import { buildMediaUrl } from "../../media/utils/mediaUrl.util.js";

export const attachmentResponse = (media: Partial<IMedia> & { _id: any }) => ({
    attachmentId: String(media._id),
    mediaId: String(media._id),
    fileName: media.originalFileName ?? "",
    mimeType: media.mimeType ?? "",
    size: media.size ?? 0,
    status: media.status,
    url: buildMediaUrl(media.storageKey, media.publicUrl),
    addedBy: String(media.uploadedBy ?? ""),
    sortOrder: media.sortOrder ?? 0,
    uploadedAt: media.uploadedAt ?? null,
    createdAt: media.createdAt,
});

export type StickyNoteAttachmentResponse = ReturnType<typeof attachmentResponse>;
