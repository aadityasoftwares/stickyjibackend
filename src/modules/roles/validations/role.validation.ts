import {
    RoleType,
    RoleScope,
} from "../constants/role.enums.js";

export const RoleValidation = {
    types:
        Object.values(
            RoleType
        ),

    scopes:
        Object.values(
            RoleScope
        ),
};