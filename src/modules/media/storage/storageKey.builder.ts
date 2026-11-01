import { randomUUID } from "node:crypto";
import { MediaPurpose } from "../constants/media.enums.js";
import { MEDIA_CONSTANTS } from "../constants/media.constants.js";
import { AppError } from "../../../utils/errors/app.error.js";

export interface MediaStorageScope {
    accountId: string;
    tenantId?: string;
    workspaceId?: string;
    noteId?: string;
}

const purposeFolders: Record<MediaPurpose, string> = {
    AVATAR: "avatars",
    PROFILE_IMAGE: "avatars",
    LOGO: "logos",
    ICON: "icons",
    COVER: "covers",
    THUMBNAIL: "thumbnails",
    ATTACHMENT: "attachments",
    GALLERY: "gallery",
    CONTENT: "content",
    DOCUMENT: "documents",
    OTHER: "other",
};

/** Receives only server-resolved ownership. Never accepts raw client path segments. */
export class StorageKeyBuilder {
    static readonly VERSION = 2;

    static build(
        scope: MediaStorageScope,
        purpose: MediaPurpose,
        extension: string,
        now = new Date(),
    ): string {
        const segment = (value: string): string => {
            if (!/^[a-f\d]{24}$/i.test(value)) throw new AppError("Invalid storage ownership.", 400);
            return value.toLowerCase();
        };
        const extensions = new Set(Object.values(MEDIA_CONSTANTS.MIME_TYPE_EXTENSIONS).flat());
        if (!extensions.has(extension) || !/^[a-z0-9]+$/.test(extension)) {
            throw new AppError("Unsupported storage extension.", 400);
        }
        const folder = purposeFolders[purpose];
        if (!folder) throw new AppError("Unsupported storage purpose.", 400);
        let prefix = `accounts/${segment(scope.accountId)}/users/${segment(scope.accountId)}/${folder}`;
        if (scope.workspaceId) {
            if (!scope.tenantId) throw new AppError("Missing storage tenant.", 400);
            prefix = `tenants/${segment(scope.tenantId)}/workspaces/${segment(scope.workspaceId)}`;
            prefix += scope.noteId ? `/notes/${segment(scope.noteId)}/${folder}` : `/assets/${folder}`;
        } else if (scope.tenantId || scope.noteId) {
            throw new AppError("Invalid storage scope.", 400);
        }
        return `${prefix}/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}/${randomUUID()}.${extension}`;
    }
}
