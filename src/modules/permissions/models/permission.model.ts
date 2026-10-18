import mongoose, { Schema, Model } from "mongoose";

import type { IPermissionDocument } from "../interfaces/permission.interface.js";

import { PermissionAccess, PermissionAction } from "../constants/permission.enums.js";

import { DEFAULT_PERMISSION_STATUS } from "../constants/permission.constants.js";

const PermissionSchema = new Schema<IPermissionDocument>(
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

        /**
         * The application feature.
         *
         * WORKSPACE
         * ROLES
         * MEMBERS
         * NOTES
         * FOLDERS
         * TASKS
         */
        module: {
            type: String,
            required: true,
            uppercase: true,
            trim: true,
        },

        action: {
            type: String,
            enum: Object.values(PermissionAction),
            required: true,
        },

        /**
         * GENERAL
         * OWN
         * ANY
         */
        access: {
            type: String,
            enum: Object.values(PermissionAccess),
            required: true,
            default: PermissionAccess.GENERAL,
        },

        description: {
            type: String,
            trim: true,
            default: "",
        },

        /**
         * Used by frontend when rendering
         * permissions inside role builder.
         */
        sortOrder: {
            type: Number,
            default: 0,
        },

        /**
         * System permissions represent
         * application capabilities and should
         * not be editable by normal users.
         */
        isSystem: {
            type: Boolean,
            default: true,
        },

        isActive: {
            type: Boolean,
            default: DEFAULT_PERMISSION_STATUS,
        },

        createdBy: {
            type: Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },

        updatedBy: {
            type: Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },
    },
    {
        timestamps: true,
    },
);

PermissionSchema.index(
    {
        name: 1,
    },
    {
        unique: true,
    },
);

PermissionSchema.index(
    {
        code: 1,
    },
    {
        unique: true,
    },
);

PermissionSchema.index({
    module: 1,
});

PermissionSchema.index({
    action: 1,
});

PermissionSchema.index({
    access: 1,
});

PermissionSchema.index({
    isSystem: 1,
});

PermissionSchema.index({
    isActive: 1,
});

/**
 * Important:
 *
 * NOTES + UPDATE + OWN
 * NOTES + UPDATE + ANY
 *
 * are different permissions.
 */
PermissionSchema.index(
    {
        module: 1,
        action: 1,
        access: 1,
    },
    {
        unique: true,
    },
);

PermissionSchema.index({
    module: 1,
    isActive: 1,
    sortOrder: 1,
});

export const PermissionModel: Model<IPermissionDocument> = mongoose.model<IPermissionDocument>(
    "Permission",
    PermissionSchema,
);
