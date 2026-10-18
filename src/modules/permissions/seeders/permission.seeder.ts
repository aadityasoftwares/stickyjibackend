import {
    PermissionModel,
} from "../models/permission.model.js";

import {
    PERMISSION_DEFINITIONS,
} from "../constants/permission.constants.js";

export const seedPermissions =
    async (): Promise<void> => {
        try {
            if (
                !PERMISSION_DEFINITIONS.length
            ) {
                console.log(
                    "No system permissions configured."
                );

                return;
            }

            const operations =
                PERMISSION_DEFINITIONS.map(
                    (
                        permission
                    ) => {
                        return {
                            updateOne: {
                                filter: {
                                    code:
                                        permission.code
                                            .trim()
                                            .toUpperCase(),
                                },

                                update: {
                                    $set: {
                                        name:
                                            permission.name
                                                .trim()
                                                .toLowerCase(),

                                        displayName:
                                            permission.displayName
                                                .trim(),

                                        code:
                                            permission.code
                                                .trim()
                                                .toUpperCase(),

                                        module:
                                            permission.module
                                                .trim()
                                                .toUpperCase(),

                                        action:
                                            permission.action,

                                        access:
                                            permission.access,

                                        description:
                                            permission.description ??
                                            "",

                                        sortOrder:
                                            permission.sortOrder ??
                                            0,

                                        isSystem:
                                            true,

                                        isActive:
                                            true,
                                    },

                                    $setOnInsert: {
                                        createdBy:
                                            null,

                                        updatedBy:
                                            null,
                                    },
                                },

                                upsert:
                                    true,
                            },
                        };
                    }
                );

            const result =
                await PermissionModel.bulkWrite(
                    operations
                );

            console.log(
                [
                    "System permissions seeded successfully.",
                    `Configured: ${PERMISSION_DEFINITIONS.length}`,
                    `Inserted: ${result.upsertedCount}`,
                    `Updated: ${result.modifiedCount}`,
                    `Matched: ${result.matchedCount}`,
                ].join(" ")
            );
        } catch (error) {
            console.error(
                "Permission seeding failed:",
                error
            );

            throw error;
        }
    };