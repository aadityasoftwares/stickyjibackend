import { z } from "zod";

// Create Workspace Role Schema
export const createWorkspaceRoleSchema = z.object({
    name: z
        .string()
        .min(2, "Role name must be at least 2 characters")
        .max(100, "Role name cannot exceed 100 characters")
        .transform(val => val.trim()),

    description: z
        .string()
        .max(255, "Description cannot exceed 255 characters")
        .optional(),

    permissions: z
        .array(z.string().length(24, "Invalid permission ID")) // Mongo ObjectId
        .optional(),

    isActive: z.boolean().optional().default(true),
});

// Update Workspace Role Schema
export const updateWorkspaceRoleSchema = z.object({
    name: z
        .string()
        .min(2, "Role name must be at least 2 characters")
        .max(100, "Role name cannot exceed 100 characters")
        .transform(val => val.trim())
        .optional(),

    description: z.string().max(255, "Description cannot exceed 255 characters").optional(),

    permissions: z
        .array(z.string().length(24, "Invalid permission ID"))
        .optional(),

    isActive: z.boolean().optional(),
}).strict();