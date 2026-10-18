import { Types } from "mongoose";
import { WorkspaceRepository } from "../repositories/workspace.repository.js";
import { isWorkspaceTrashed } from "../constants/workspace.enums.js";
import { WorkspaceMessages } from "../constants/workspace.messages.js";
import { AppError } from "../../../utils/errors/app.error.js";
import { MediaRepository } from "../../media/repositories/media.repository.js";

export class WorkspacePurgeService {
    private readonly repository = new WorkspaceRepository();
    private readonly mediaRepository = new MediaRepository();

    async purgeById(id: string) {
        if (!Types.ObjectId.isValid(id)) throw new AppError(WorkspaceMessages.NOT_FOUND, 404);
        const result = await this.repository.runInTransaction(async session => {
            const workspace = await this.repository.findPurgeCandidate(id, session);
            if (!workspace) throw new AppError(WorkspaceMessages.NOT_FOUND, 404);
            if (!isWorkspaceTrashed(workspace.status)) throw new AppError(WorkspaceMessages.PERMANENT_DELETE_REQUIRES_TRASH, 400);
            if (workspace.isPersonal) throw new AppError(WorkspaceMessages.CANNOT_DELETE_PERSONAL_WORKSPACE, 400);
            if (await this.repository.hasSharedRoles(id, session)) throw new AppError(WorkspaceMessages.SHARED_ROLES, 409);
            const deleted = await this.repository.deleteDependentData(id, session);
            if (deleted.deletedWorkspaces !== 1) throw new AppError(WorkspaceMessages.NOT_FOUND, 404);
            return deleted;
        });
        await this.cleanupDeletedMedia();
        return result;
    }

    async cleanupDeletedMedia() {
        const media = await this.mediaRepository.findPendingStorageDeletions();
        const result = { deleted: 0, failed: 0 };
        for (const file of media) {
            try {
                const { CloudflareR2Service } = await import("../../media/storage/cloudflareR2.service.js");
                const storageService = new CloudflareR2Service();
                // Never apply a stored key to a different configured bucket.
                if (file.bucket !== storageService.getBucketName()) throw new Error("Media bucket mismatch.");
                await storageService.deleteObject(file.storageKey);
                await this.mediaRepository.deleteStorageTombstone(file._id.toString());
                result.deleted += 1;
            } catch { result.failed += 1; }
        }
        return result;
    }
}
