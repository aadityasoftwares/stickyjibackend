import { Types } from "mongoose";
import { MediaModel } from "../../media/models/media.model.js";
import { MediaPurpose, MediaResourceType, MediaStatus } from "../../media/constants/media.enums.js";
import type { MediaStorageScope } from "../../media/storage/storageKey.builder.js";
import { StickyNoteModel } from "../../stickynotes/models/stickynote.model.js";
import { StickyNoteStatus } from "../../stickynotes/constants/stickyNote.enums.js";
import { WorkspaceModel } from "../../workspace/models/workspace.model.js";
import { isWorkspaceTrashed } from "../../workspace/constants/workspace.enums.js";
import { attachmentResponse, type StickyNoteAttachmentResponse } from "../utils/attachmentResponse.js";

/** Media already stores the one-note/one-file relationship. Attachment IDs are Media IDs. */
export class StickyNoteAttachmentRepository {
    /** Enrich notes already selected by the caller's note authorization/filtering. */
    async findMap(noteIds: string[]): Promise<Map<string, StickyNoteAttachmentResponse[]>> {
        const map = new Map<string, StickyNoteAttachmentResponse[]>();
        const ids = [...new Set(noteIds)].filter((id) => Types.ObjectId.isValid(id));
        if (!ids.length) return map;

        const notes = await StickyNoteModel.find({
            _id: { $in: ids },
            status: { $in: [StickyNoteStatus.ACTIVE, StickyNoteStatus.ARCHIVED] },
        }).select("_id workspaceId").lean().exec();
        if (!notes.length) return map;

        const workspaces = await WorkspaceModel.find({
            _id: { $in: notes.map((note) => note.workspaceId) },
        }).select("_id ownerId status").lean().exec();
        const workspaceMap = new Map(workspaces
            .filter((workspace) => !isWorkspaceTrashed(workspace.status))
            .map((workspace) => [String(workspace._id), workspace]));
        const scopes = notes.flatMap((note) => {
            const workspace = workspaceMap.get(String(note.workspaceId));
            return workspace ? [this.filter({
                accountId: String(workspace.ownerId),
                tenantId: String(workspace.ownerId),
                workspaceId: String(workspace._id),
                noteId: String(note._id),
            })] : [];
        });
        if (!scopes.length) return map;

        const media = await MediaModel.find({ $or: scopes, status: MediaStatus.ACTIVE })
            .select("_id resourceId originalFileName mimeType size status uploadedBy sortOrder uploadedAt createdAt")
            .sort({ sortOrder: 1, createdAt: 1, _id: 1 }).lean().exec();
        for (const item of media) {
            const noteId = String(item.resourceId);
            const attachments = map.get(noteId) ?? [];
            attachments.push(attachmentResponse(item));
            map.set(noteId, attachments);
        }
        return map;
    }

    filter(scope: MediaStorageScope) {
        return {
            resourceType: MediaResourceType.NOTE,
            resourceId: new Types.ObjectId(scope.noteId),
            purpose: MediaPurpose.ATTACHMENT,
            storageDeletionPending: { $ne: true },
            $or: [
                {
                    tenantId: new Types.ObjectId(scope.tenantId),
                    workspaceId: new Types.ObjectId(scope.workspaceId),
                },
                { tenantId: null, storageKeyVersion: { $ne: 2 } },
            ],
        };
    }
    find(scope: MediaStorageScope, id: string) {
        return MediaModel.findOne({
            ...this.filter(scope),
            _id: id,
            status: { $ne: MediaStatus.DELETED },
        }).exec();
    }
    async list(scope: MediaStorageScope, page: number, limit: number) {
        const filter = { ...this.filter(scope), status: MediaStatus.ACTIVE };
        const [data, total] = await Promise.all([
            MediaModel.find(filter)
                .sort({ sortOrder: 1, createdAt: 1, _id: 1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .lean()
                .exec(),
            MediaModel.countDocuments(filter),
        ]);
        return { data, total, page, limit };
    }
}
