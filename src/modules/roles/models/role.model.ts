import mongoose, {
    Schema,
    Model,
} from "mongoose";

import type {
    IRoleDocument,
} from "../interfaces/role.interface.js";

import {
    RoleType,
    RoleScope,
} from "../constants/role.enums.js";

import {
    DEFAULT_ROLE_STATUS,
} from "../constants/role.constants.js";

const RoleSchema =
    new Schema<IRoleDocument>(
        {
            name: {
                type: String,
                required: true,
                trim: true,
                lowercase: true,
            },

            displayName: {
                type: String,
                required: true,
                trim: true,
            },

            code: {
                type: String,
                required: true,
                uppercase: true,
                trim: true,
            },

            description: {
                type: String,
                trim: true,
                default: "",
            },

            type: {
                type: String,
                enum: Object.values(
                    RoleType
                ),
                required: true,
                default:
                    RoleType.CUSTOM,
            },

            scope: {
                type: String,
                enum: Object.values(
                    RoleScope
                ),
                required: true,
                default:
                    RoleScope.WORKSPACE,
            },

            /**
             * null:
             * System/global role.
             *
             * ObjectId:
             * Role belongs to one workspace.
             */
            workspaceId: {
                type:
                    Schema.Types
                        .ObjectId,
                ref: "Workspace",
                default: null,
            },

            permissions: {
                type: [
                    {
                        type:
                            Schema.Types
                                .ObjectId,
                        ref: "Permission",
                    },
                ],
                default: [],
            },

            isSystem: {
                type: Boolean,
                default: false,
            },

            /**
             * Currently used by seeded system roles.
             *
             * WORKSPACE_MEMBER is the default
             * role when someone joins.
             */
            isDefault: {
                type: Boolean,
                default: false,
            },

            /**
             * Helpful later when preventing
             * lower roles from assigning higher roles.
             *
             * OWNER 100
             * ADMIN 80
             * MEMBER 50
             * VIEWER 10
             */
            priority: {
                type: Number,
                default: 0,
            },

            isActive: {
                type: Boolean,
                default:
                    DEFAULT_ROLE_STATUS,
            },

            createdBy: {
                type:
                    Schema.Types
                        .ObjectId,
                ref: "User",
                default: null,
            },

            updatedBy: {
                type:
                    Schema.Types
                        .ObjectId,
                ref: "User",
                default: null,
            },
        },
        {
            timestamps: true,
        }
    );

/**
 * System role codes must be globally unique.
 *
 * SUPER_ADMIN
 * USER
 * WORKSPACE_OWNER
 * WORKSPACE_ADMIN
 * etc.
 */
RoleSchema.index(
    {
        code: 1,
    },
    {
        unique: true,
        name: "uniq_system_role_code",
        partialFilterExpression: {
            isSystem: true,
        },
    }
);

/**
 * Custom role code only needs to be
 * unique inside its workspace.
 *
 * Workspace A -> DESIGNER
 * Workspace B -> DESIGNER
 *
 * Both are allowed.
 */
RoleSchema.index(
    {
        workspaceId: 1,
        code: 1,
    },
    {
        unique: true,
        name:
            "uniq_workspace_role_code",
        partialFilterExpression: {
            isSystem: false,
            workspaceId: {
                $type: "objectId",
            },
        },
    }
);

RoleSchema.index(
    {
        workspaceId: 1,
        name: 1,
    },
    {
        unique: true,
        name:
            "uniq_workspace_role_name",
        partialFilterExpression: {
            isSystem: false,
            workspaceId: {
                $type: "objectId",
            },
        },
    }
);

RoleSchema.index({
    workspaceId: 1,
    isActive: 1,
});

RoleSchema.index({
    type: 1,
});

RoleSchema.index({
    scope: 1,
});

RoleSchema.index({
    isActive: 1,
});

RoleSchema.index({
    isSystem: 1,
});

RoleSchema.index({
    permissions: 1,
});

RoleSchema.index({
    scope: 1,
    isSystem: 1,
    isActive: 1,
});

RoleSchema.index({
    isActive: 1,
    type: 1,
});

export const RoleModel: Model<IRoleDocument> =
    mongoose.model<IRoleDocument>(
        "Role",
        RoleSchema
    );