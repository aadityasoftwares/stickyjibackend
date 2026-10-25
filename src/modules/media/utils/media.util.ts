import path from "node:path";
import { MEDIA_CONSTANTS } from "../constants/media.constants.js";
import { MediaMessages } from "../constants/media.messages.js";
import { MediaPurpose, MediaType } from "../constants/media.enums.js";

export class MediaUtil {
    /**
     * Sanitizes original filename:
     * - Strips path traversal characters (directory paths)
     * - Removes non-printable/control characters and null bytes
     * - Restricts length to MAX_FILE_NAME_LENGTH
     */
    static sanitizeFileName(fileName: string): string {
        if (!fileName || typeof fileName !== "string") {
            return "";
        }

        // Strip directory separators and extract base name
        let clean = path.basename(fileName.trim());

        // Remove control characters (ASCII 0-31, 127-159) and null bytes
        // eslint-disable-next-line no-control-regex
        clean = clean.replace(/[\x00-\x1f\x7f-\x9f]/g, "").trim();

        // Remove dangerous characters (leading dots that hide files or path traversal)
        clean = clean.replace(/^[. ]+/, "");

        // If filename became empty after stripping
        if (!clean || clean === "." || clean === "..") {
            return "";
        }

        if (clean.length > MEDIA_CONSTANTS.MAX_FILE_NAME_LENGTH) {
            clean = clean.slice(0, MEDIA_CONSTANTS.MAX_FILE_NAME_LENGTH);
        }

        return clean;
    }

    public static readonly EXTENSION_BY_MIME_TYPE: Record<string, string> = {
        "image/jpeg": "jpg",
        "image/png": "png",
        "image/webp": "webp",
        "image/gif": "gif",
        "image/svg+xml": "svg",
        "video/mp4": "mp4",
        "video/webm": "webm",
        "video/quicktime": "mov",
        "audio/mpeg": "mp3",
        "audio/wav": "wav",
        "audio/ogg": "ogg",
        "audio/webm": "webm",
        "application/pdf": "pdf",
        "text/plain": "txt",
        "application/msword": "doc",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
        "application/vnd.ms-excel": "xls",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
        "application/vnd.ms-powerpoint": "ppt",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
    };

    public static readonly PROFILE_IMAGE_EXTENSION_BY_MIME: Record<string, string> = {
        "image/jpeg": "jpg",
        "image/png": "png",
        "image/webp": "webp",
    };

    /**
     * Extracts lowercase extension without dot.
     * Strips query parameters, hashes, and directory characters.
     */
    static extractExtension(fileName: string): string | null {
        if (!fileName || typeof fileName !== "string") return null;
        const cleanName = fileName.split("?")[0]?.split("#")[0]?.trim() ?? "";
        const ext = path.extname(cleanName).toLowerCase().replace(/^\.+/, "").trim();
        if (!ext || ext.includes("/") || ext.includes("\\")) return null;
        return ext.slice(0, MEDIA_CONSTANTS.MAX_EXTENSION_LENGTH);
    }

    /**
     * Resolves a validated, secure file extension based on MIME type and optional original filename.
     * Guaranteed never to return a slash, MIME type string, or active script extension.
     */
    static resolveExtension(fileName: string, mimeType: string, purpose?: MediaPurpose): string {
        const normalizedMime = (mimeType || "").trim().toLowerCase();

        // For profile images and avatars, strictly enforce profile image extension mapping
        if (purpose === MediaPurpose.PROFILE_IMAGE || purpose === MediaPurpose.AVATAR) {
            const profileExt = MediaUtil.PROFILE_IMAGE_EXTENSION_BY_MIME[normalizedMime];
            if (profileExt) {
                return profileExt;
            }
        }

        const rawExt = MediaUtil.extractExtension(fileName);
        if (rawExt && /^[a-z0-9]{1,10}$/.test(rawExt)) {
            if (MediaUtil.isExtensionAllowedForMimeType(normalizedMime, rawExt)) {
                if (rawExt === "jpeg") {
                    return "jpg";
                }
                return rawExt;
            }
        }

        const canonical = MediaUtil.EXTENSION_BY_MIME_TYPE[normalizedMime];
        if (canonical) {
            return canonical;
        }

        const allowed = MEDIA_CONSTANTS.MIME_TYPE_EXTENSIONS[normalizedMime];
        if (allowed && allowed.length > 0 && allowed[0]) {
            return allowed[0];
        }

        if (rawExt && /^[a-z0-9]{1,10}$/.test(rawExt)) {
            return rawExt;
        }

        return "bin";
    }

    /**
     * Checks if extension matches the MIME type when defined in MIME_TYPE_EXTENSIONS
     */
    static isExtensionAllowedForMimeType(mimeType: string, extension: string | null): boolean {
        if (!extension) {
            return true;
        }

        const normalizedMime = mimeType.trim().toLowerCase();
        const normalizedExt = extension.trim().toLowerCase().replace(".", "");

        const allowedExtensions = MEDIA_CONSTANTS.MIME_TYPE_EXTENSIONS[normalizedMime];
        if (!allowedExtensions || allowedExtensions.length === 0) {
            return true;
        }

        return allowedExtensions.includes(normalizedExt);
    }

    /**
     * Validates file size against positive safe integer and both mediaType and purpose limits
     */
    static validateFileSize(
        size: number,
        mediaType: MediaType,
        purpose: MediaPurpose,
    ): { valid: boolean; message?: string } {
        if (typeof size !== "number" || !Number.isSafeInteger(size) || size <= 0) {
            return { valid: false, message: MediaMessages.INVALID_FILE_SIZE };
        }

        const maxMediaTypeSize = MEDIA_CONSTANTS.MAX_FILE_SIZE[mediaType];
        if (maxMediaTypeSize && size > maxMediaTypeSize) {
            return { valid: false, message: MediaMessages.FILE_TOO_LARGE };
        }

        const maxPurposeSize = MEDIA_CONSTANTS.MAX_PURPOSE_FILE_SIZE[purpose];
        if (maxPurposeSize && size > maxPurposeSize) {
            return { valid: false, message: MediaMessages.FILE_SIZE_EXCEEDS_PURPOSE_LIMIT };
        }

        return { valid: true };
    }

    /**
     * Validates that the mediaType is allowed for the given purpose
     */
    static isMediaTypeAllowedForPurpose(purpose: MediaPurpose, mediaType: MediaType): boolean {
        const allowedTypes = MEDIA_CONSTANTS.ALLOWED_PURPOSE_MEDIA_TYPES[purpose] as readonly MediaType[] | undefined;
        if (!allowedTypes || allowedTypes.length === 0) {
            return true;
        }
        return allowedTypes.includes(mediaType);
    }
}
