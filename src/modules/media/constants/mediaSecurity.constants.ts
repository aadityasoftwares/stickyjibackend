import { MediaType } from "./media.enums.js";
import { AppError } from "../../../utils/errors/app.error.js";

const formats: Record<string, { extension: string; mediaType: MediaType; scan: boolean }> = {
    "image/jpeg": { extension: "jpg", mediaType: MediaType.IMAGE, scan: false },
    "image/png": { extension: "png", mediaType: MediaType.IMAGE, scan: false },
    "image/webp": { extension: "webp", mediaType: MediaType.IMAGE, scan: false },
    "text/plain": { extension: "txt", mediaType: MediaType.DOCUMENT, scan: false },
    "text/csv": { extension: "csv", mediaType: MediaType.DOCUMENT, scan: false },
    "application/pdf": { extension: "pdf", mediaType: MediaType.DOCUMENT, scan: true },
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": {
        extension: "docx",
        mediaType: MediaType.DOCUMENT,
        scan: true,
    },
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": {
        extension: "xlsx",
        mediaType: MediaType.DOCUMENT,
        scan: true,
    },
};

export const MediaSecurity = {
    formats,
    maxFileBytes: () => {
        const value = Number(process.env.MEDIA_MAX_FILE_BYTES ?? 26214400);
        if (!Number.isSafeInteger(value) || value < 1 || value > 104857600)
            throw new Error("Invalid MEDIA_MAX_FILE_BYTES.");
        return value;
    },
    format(mime: string) {
        const format = formats[mime];
        const configured = process.env.MEDIA_ALLOWED_MIME_TYPES?.split(",").map((item) => item.trim());
        if (
            !format ||
            (configured && !configured.includes(mime)) ||
            (format.scan && !process.env.MEDIA_CLAMSCAN_PATH)
        ) {
            throw new AppError("This file type is not enabled for secure uploads.", 400);
        }
        return format;
    },
};
