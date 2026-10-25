import { MediaPurpose, MediaType, MediaVisibility } from "./media.enums.js";

export const MEDIA_CONSTANTS = {
    UPLOAD_URL_EXPIRES_IN_SECONDS: 15 * 60,
    DOWNLOAD_URL_EXPIRES_IN_SECONDS: 15 * 60,
    PENDING_UPLOAD_EXPIRY_MINUTES: 60,
    CLEANUP_BATCH_SIZE: 100,

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

    MAX_PURPOSE_FILE_SIZE: {
        [MediaPurpose.AVATAR]: 5 * 1024 * 1024,
        [MediaPurpose.PROFILE_IMAGE]: 5 * 1024 * 1024,
        [MediaPurpose.ICON]: 2 * 1024 * 1024,
        [MediaPurpose.LOGO]: 5 * 1024 * 1024,
        [MediaPurpose.THUMBNAIL]: 5 * 1024 * 1024,
        [MediaPurpose.COVER]: 10 * 1024 * 1024,
        [MediaPurpose.ATTACHMENT]: 100 * 1024 * 1024,
        [MediaPurpose.GALLERY]: 25 * 1024 * 1024,
        [MediaPurpose.CONTENT]: 25 * 1024 * 1024,
        [MediaPurpose.DOCUMENT]: 50 * 1024 * 1024,
        [MediaPurpose.OTHER]: 50 * 1024 * 1024,
    },

    ALLOWED_PURPOSE_MEDIA_TYPES: {
        [MediaPurpose.AVATAR]: [MediaType.IMAGE],
        [MediaPurpose.PROFILE_IMAGE]: [MediaType.IMAGE],
        [MediaPurpose.ICON]: [MediaType.IMAGE],
        [MediaPurpose.LOGO]: [MediaType.IMAGE],
        [MediaPurpose.COVER]: [MediaType.IMAGE],
        [MediaPurpose.THUMBNAIL]: [MediaType.IMAGE],
        [MediaPurpose.GALLERY]: [MediaType.IMAGE, MediaType.VIDEO],
        [MediaPurpose.DOCUMENT]: [MediaType.DOCUMENT],
        [MediaPurpose.ATTACHMENT]: [
            MediaType.IMAGE,
            MediaType.VIDEO,
            MediaType.AUDIO,
            MediaType.DOCUMENT,
            MediaType.OTHER,
        ],
        [MediaPurpose.CONTENT]: [
            MediaType.IMAGE,
            MediaType.VIDEO,
            MediaType.AUDIO,
            MediaType.DOCUMENT,
            MediaType.OTHER,
        ],
        [MediaPurpose.OTHER]: [
            MediaType.IMAGE,
            MediaType.VIDEO,
            MediaType.AUDIO,
            MediaType.DOCUMENT,
            MediaType.OTHER,
        ],
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

    MIME_TYPE_EXTENSIONS: {
        "image/jpeg": ["jpg", "jpeg"],
        "image/png": ["png"],
        "image/webp": ["webp"],
        "image/gif": ["gif"],
        "image/svg+xml": ["svg"],
        "video/mp4": ["mp4"],
        "video/webm": ["webm"],
        "video/quicktime": ["mov"],
        "audio/mpeg": ["mp3"],
        "audio/wav": ["wav"],
        "audio/ogg": ["ogg"],
        "audio/webm": ["weba", "webm"],
        "application/pdf": ["pdf"],
        "text/plain": ["txt"],
        "application/msword": ["doc"],
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ["docx"],
        "application/vnd.ms-excel": ["xls"],
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ["xlsx"],
        "application/vnd.ms-powerpoint": ["ppt"],
        "application/vnd.openxmlformats-officedocument.presentationml.presentation": ["pptx"],
    } as Record<string, readonly string[]>,

    DEFAULT_VISIBILITY: MediaVisibility.PRIVATE,

    DEFAULT_SORT_BY: "createdAt",
    DEFAULT_SORT_ORDER: "desc" as const,
} as const;
