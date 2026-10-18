import { z } from "zod";

export const createWorkspacePermissionSchema = z.object({
    name: z
        .string()
        .min(2, "Permission name must be at least 2 characters")
        .max(100, "Permission name cannot exceed 100 characters")
        .transform(val => val.trim()),

    description: z
        .string()
        .max(255, "Description cannot exceed 255 characters")
        .optional(),

    isActive: z.boolean().optional().default(true),
});

export const updateWorkspacePermissionSchema = z.object({
    name: z
        .string()
        .min(2, "Permission name must be at least 2 characters")
        .max(100, "Permission name cannot exceed 100 characters")
        .transform(val => val.trim())
        .optional(),

    description: z.string().max(255, "Description cannot exceed 255 characters").optional(),

    isActive: z.boolean().optional(),
}).strict();