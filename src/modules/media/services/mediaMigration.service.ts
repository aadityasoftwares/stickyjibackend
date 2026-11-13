import { Types } from "mongoose";
import { WorkspaceModel } from "../../workspace/models/workspace.model.js";
import { StickyNoteModel } from "../../stickynotes/models/stickynote.model.js";
import { UserModel } from "../../user/models/user.model.js";
import { MediaResourceType } from "../constants/media.enums.js";
import type { IMedia } from "../interfaces/media.interface.js";

/** No path-prefix inference: authoritative ownership comes only from live DB references. */
export async function resolveLegacyMediaOwnership(media: IMedia) {
    if (!(await UserModel.exists({ _id: media.uploadedBy }))) throw new Error("Orphaned uploader");
    if (!media.resourceType || media.resourceType === MediaResourceType.USER) {
        if (media.resourceId && String(media.resourceId) !== String(media.uploadedBy))
            throw new Error("Ambiguous account resource");
        return { tenantId: null, workspaceId: null, storageKeyVersion: media.storageKeyVersion ?? 1 };
    }
    let workspaceId: Types.ObjectId | null = null;
    if (media.resourceType === MediaResourceType.NOTE) {
        const note = await StickyNoteModel.findById(media.resourceId).select("workspaceId").lean().exec();
        if (!note) throw new Error("Orphaned note");
        workspaceId = note.workspaceId;
    } else if (media.resourceType === MediaResourceType.WORKSPACE) workspaceId = media.resourceId ?? null;
    else throw new Error("Unsupported resource ownership requires manual reconciliation");
    const workspace = await WorkspaceModel.findById(workspaceId).select("ownerId").lean().exec();
    if (!workspace || !(await UserModel.exists({ _id: workspace.ownerId })))
        throw new Error("Orphaned workspace/account");
    if (
        (media.tenantId && String(media.tenantId) !== String(workspace.ownerId)) ||
        (media.workspaceId && String(media.workspaceId) !== String(workspaceId))
    )
        throw new Error("Ownership conflict");
    return { tenantId: workspace.ownerId, workspaceId, storageKeyVersion: media.storageKeyVersion ?? 1 };
}
