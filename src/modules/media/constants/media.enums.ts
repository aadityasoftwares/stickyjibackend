export enum MediaStatus {
    PENDING = "PENDING",
    ACTIVE = "ACTIVE",
    FAILED = "FAILED",
    DELETED = "DELETED",
}

export enum MediaType {
    IMAGE = "IMAGE",
    VIDEO = "VIDEO",
    AUDIO = "AUDIO",
    DOCUMENT = "DOCUMENT",
    OTHER = "OTHER",
}

export enum MediaPurpose {
    AVATAR = "AVATAR",
    LOGO = "LOGO",
    ICON = "ICON",
    COVER = "COVER",
    THUMBNAIL = "THUMBNAIL",
    ATTACHMENT = "ATTACHMENT",
    GALLERY = "GALLERY",
    CONTENT = "CONTENT",
    DOCUMENT = "DOCUMENT",
    OTHER = "OTHER",
}

export enum MediaVisibility {
    PUBLIC = "PUBLIC",
    PRIVATE = "PRIVATE",
}

export enum MediaStorageProvider {
    CLOUDFLARE_R2 = "CLOUDFLARE_R2",
}

export enum MediaResourceType {
    USER = "USER",
    WORKSPACE = "WORKSPACE",
    NOTE = "NOTE",
    TASK = "TASK",
    COMMENT = "COMMENT",
    PROJECT = "PROJECT",
    FEATURE = "FEATURE",
    PLAN = "PLAN",
    DOCUMENT = "DOCUMENT",
    OTHER = "OTHER",
}