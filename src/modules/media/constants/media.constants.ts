import { MediaType, MediaVisibility } from "./media.enums.js";

export const MEDIA_CONSTANTS = {
    UPLOAD_URL_EXPIRES_IN_SECONDS: 15 * 60,
    PENDING_UPLOAD_EXPIRY_MINUTES: 60,

    MAX_FILE_NAME_LENGTH: 255,
    MAX_MIME_TYPE_LENGTH: 150,
    MAX_EXTENSION_LENGTH: 20,
    MAX_RESOURCE_TYPE_LENGTH: 100,
    MAX_SEARCH_LENGTH: 100,

    DEFAULT_PAGE: 1,
    DEFAULT_LIMIT: 10,
    MAX_LIMIT: 100,

    MAX_FILE_SIZE: {
        [MediaType.IMAGE]: 10 * 1024 * 1024,
        [MediaType.VIDEO]: 100 * 1024 * 1024,
        [MediaType.AUDIO]: 50 * 1024 * 1024,
        [MediaType.DOCUMENT]: 25 * 1024 * 1024,
        [MediaType.OTHER]: 25 * 1024 * 1024,
    },

    ALLOWED_MIME_TYPES: {
        [MediaType.IMAGE]: ["image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml"],

        [MediaType.VIDEO]: ["video/mp4", "video/webm", "video/quicktime"],

        [MediaType.AUDIO]: ["audio/mpeg", "audio/wav", "audio/ogg", "audio/webm"],

        [MediaType.DOCUMENT]: [
            "application/pdf",
            "text/plain",
            "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "application/vnd.ms-excel",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "application/vnd.ms-powerpoint",
            "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        ],

        [MediaType.OTHER]: [],
    },

    DEFAULT_VISIBILITY: MediaVisibility.PRIVATE,

    DEFAULT_SORT_BY: "createdAt",
    DEFAULT_SORT_ORDER: "desc" as const,
} as const;
