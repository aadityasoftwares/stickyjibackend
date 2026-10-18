import {
    PermissionAccess,
    PermissionAction,
} from "../constants/permission.enums.js";

export const PermissionValidation = {
    actions:
        Object.values(
            PermissionAction
        ),

    accesses:
        Object.values(
            PermissionAccess
        ),
};