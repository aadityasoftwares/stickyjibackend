import type {
    Types,
} from "mongoose";

import {
    PermissionModel,
} from "../../permissions/models/permission.model.js";

import {
    RoleScope,
    RoleType,
} from "../constants/role.enums.js";

import {
    SYSTEM_ROLE_CODES,
    WORKSPACE_ROLE_PERMISSION_CODES,
} from "../constants/role.constants.js";

import {
    RoleModel,
} from "../models/role.model.js";
import { PERMISSION_CODES } from "../../permissions/constants/permission.constants.js";

interface SystemRoleSeed {
    name: string;

    displayName: string;

    code: string;

    description: string;

    type: RoleType;

    scope: RoleScope;

    permissions:
    Types.ObjectId[];

    isSystem: true;

    isDefault: boolean;

    priority: number;

    isActive: true;
}

export const seedRoles =
    async (): Promise<void> => {

        const activePermissions =
            await PermissionModel
                .find({
                    isActive:
                        true,
                })
                .select(
                    "_id code"
                )
                .lean();

        const allPermissionIds =
            activePermissions.map(
                (
                    permission
                ) =>
                    permission._id
            );

        const permissionMap =
            new Map<
                string,
                Types.ObjectId
            >();

        for (
            const permission of
            activePermissions
        ) {
            permissionMap.set(
                permission.code,
                permission._id
            );
        }

        const getPermissionIds =
            (
                codes:
                    readonly string[]
            ) => {
                return codes
                    .map(
                        (
                            code
                        ) =>
                            permissionMap.get(
                                code
                            )
                    )
                    .filter(
                        (
                            id
                        ): id is Types.ObjectId =>
                            !!id
                    );
            };

        const ownerPermissions =
            getPermissionIds(
                WORKSPACE_ROLE_PERMISSION_CODES.OWNER
            );

        const adminPermissions =
            getPermissionIds(
                WORKSPACE_ROLE_PERMISSION_CODES.ADMIN
            );

        const memberPermissions =
            getPermissionIds(
                WORKSPACE_ROLE_PERMISSION_CODES.MEMBER
            );

        const viewerPermissions =
            getPermissionIds(
                WORKSPACE_ROLE_PERMISSION_CODES.VIEWER
            );

        const systemRoles:
            SystemRoleSeed[] =
            [
                {
                    name:
                        "super-admin",

                    displayName:
                        "Super Administrator",

                    code:
                        SYSTEM_ROLE_CODES.SUPER_ADMIN,

                    description:
                        "Full system-level access to the application.",

                    type:
                        RoleType.SYSTEM,

                    scope:
                        RoleScope.GLOBAL,

                    permissions:
                        allPermissionIds,

                    isSystem:
                        true,

                    isDefault:
                        false,

                    priority:
                        1000,

                    isActive:
                        true,
                },

                {
                    name:
                        "user",

                    displayName:
                        "User",

                    code:
                        SYSTEM_ROLE_CODES.USER,

                    description:
                        "Default application role assigned to self-registered and standard users.",

                    type:
                        RoleType.SYSTEM,

                    scope:
                        RoleScope.GLOBAL,

                    permissions:
                        getPermissionIds([PERMISSION_CODES.WORKSPACE_CREATE]),

                    isSystem:
                        true,

                    isDefault:
                        true,

                    priority:
                        1,

                    isActive:
                        true,
                },

                {
                    name:
                        "workspace-owner",

                    displayName:
                        "Workspace Owner",

                    code:
                        SYSTEM_ROLE_CODES.WORKSPACE_OWNER,

                    description:
                        "Workspace owner with complete workspace management access.",

                    type:
                        RoleType.SYSTEM,

                    scope:
                        RoleScope.WORKSPACE,

                    permissions:
                        ownerPermissions,

                    isSystem:
                        true,

                    isDefault:
                        false,

                    priority:
                        100,

                    isActive:
                        true,
                },

                {
                    name:
                        "workspace-admin",

                    displayName:
                        "Workspace Admin",

                    code:
                        SYSTEM_ROLE_CODES.WORKSPACE_ADMIN,

                    description:
                        "Workspace administrator with member and content management access.",

                    type:
                        RoleType.SYSTEM,

                    scope:
                        RoleScope.WORKSPACE,

                    permissions:
                        adminPermissions,

                    isSystem:
                        true,

                    isDefault:
                        false,

                    priority:
                        80,

                    isActive:
                        true,
                },

                {
                    name:
                        "workspace-member",

                    displayName:
                        "Workspace Member",

                    code:
                        SYSTEM_ROLE_CODES.WORKSPACE_MEMBER,

                    description:
                        "Default collaboration role assigned when a user joins a workspace.",

                    type:
                        RoleType.SYSTEM,

                    scope:
                        RoleScope.WORKSPACE,

                    permissions:
                        memberPermissions,

                    isSystem:
                        true,

                    isDefault:
                        true,

                    priority:
                        50,

                    isActive:
                        true,
                },

                {
                    name:
                        "workspace-viewer",

                    displayName:
                        "Workspace Viewer",

                    code:
                        SYSTEM_ROLE_CODES.WORKSPACE_VIEWER,

                    description:
                        "Read-only workspace role.",

                    type:
                        RoleType.SYSTEM,

                    scope:
                        RoleScope.WORKSPACE,

                    permissions:
                        viewerPermissions,

                    isSystem:
                        true,

                    isDefault:
                        false,

                    priority:
                        10,

                    isActive:
                        true,
                },
            ];

        for (
            const role of
            systemRoles
        ) {
            await RoleModel.findOneAndUpdate(
                {
                    code:
                        role.code,

                    isSystem:
                        true,
                },
                {
                    $set: {
                        name:
                            role.name,

                        displayName:
                            role.displayName,

                        code:
                            role.code,

                        description:
                            role.description,

                        type:
                            role.type,

                        scope:
                            role.scope,

                        workspaceId:
                            null,

                        permissions:
                            role.permissions,

                        isSystem:
                            true,

                        isDefault:
                            role.isDefault,

                        priority:
                            role.priority,

                        isActive:
                            true,
                    },

                    $setOnInsert: {
                        createdBy:
                            null,

                        updatedBy:
                            null,
                    },

                    /**
                     * Removes the old
                     * role.module field.
                     */
                    $unset: {
                        module:
                            "",
                    },
                },
                {
                    upsert:
                        true,

                    returnDocument:
                        "after",

                    runValidators:
                        true,

                    setDefaultsOnInsert:
                        true,
                }
            );
        }

        console.log(
            [
                "System roles seeded successfully.",
                `SUPER_ADMIN permissions: ${allPermissionIds.length}`,
                `WORKSPACE_OWNER permissions: ${ownerPermissions.length}`,
                `WORKSPACE_ADMIN permissions: ${adminPermissions.length}`,
                `WORKSPACE_MEMBER permissions: ${memberPermissions.length}`,
                `WORKSPACE_VIEWER permissions: ${viewerPermissions.length}`,
            ].join(" ")
        );
    };
