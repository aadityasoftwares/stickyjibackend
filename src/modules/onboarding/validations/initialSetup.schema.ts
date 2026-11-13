import { z } from "zod";
import { validateUsingZOD } from "../../../utils/zodvalidate.util.js";

export const initialSetupSchema = z.object({
    workspaceTitle: z
        .string()
        .trim()
        .min(1, "Workspace title is required.")
        .max(255, "Workspace title cannot exceed 255 characters."),
    folderTitle: z
        .string()
        .trim()
        .min(1, "Folder title is required.")
        .max(255, "Folder title cannot exceed 255 characters."),
});

export type InitialSetupInput = z.infer<typeof initialSetupSchema>;

export const initialSetupValidation = validateUsingZOD(initialSetupSchema);
