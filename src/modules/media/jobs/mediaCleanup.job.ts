import { MediaService } from "../services/media.service.js";

const mediaService = new MediaService();

export const runMediaCleanup = async () => {
    const expiredCleaned = await mediaService.cleanupPendingUploads();
    const storageDeletions = await mediaService.cleanupPendingStorageDeletions();

    return {
        expiredUploadsCleaned: expiredCleaned,
        pendingStorageDeletions: storageDeletions,
    };
};
