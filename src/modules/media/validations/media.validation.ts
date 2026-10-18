import {
    MediaPurpose,
    MediaResourceType,
    MediaStatus,
    MediaType,
    MediaVisibility,
} from "../constants/media.enums.js";

export const MediaValidation = {
    mediaTypes: Object.values(MediaType) as MediaType[],
    purposes: Object.values(MediaPurpose) as MediaPurpose[],
    resourceTypes: Object.values(MediaResourceType) as MediaResourceType[],
    visibilities: Object.values(MediaVisibility) as MediaVisibility[],
    statuses: Object.values(MediaStatus) as MediaStatus[],

    isValidObjectId(value: unknown): boolean {
        return typeof value === "string" && /^[a-fA-F0-9]{24}$/.test(value);
    },

    isValidMediaType(value: unknown): value is MediaType {
        return typeof value === "string" && this.mediaTypes.includes(value as MediaType);
    },

    isValidPurpose(value: unknown): value is MediaPurpose {
        return typeof value === "string" && this.purposes.includes(value as MediaPurpose);
    },

    isValidResourceType(value: unknown): value is MediaResourceType {
        return typeof value === "string" && this.resourceTypes.includes(value as MediaResourceType);
    },

    isValidVisibility(value: unknown): value is MediaVisibility {
        return typeof value === "string" && this.visibilities.includes(value as MediaVisibility);
    },

    isValidStatus(value: unknown): value is MediaStatus {
        return typeof value === "string" && this.statuses.includes(value as MediaStatus);
    },
};
