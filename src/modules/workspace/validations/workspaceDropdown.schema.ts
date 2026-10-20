import { z } from "zod";
import { WORKSPACE_CONSTANTS } from "../constants/workspace.constants.js";

export const workspaceDropdownSchema = z.strictObject({
    search: z.string().trim().max(WORKSPACE_CONSTANTS.SEARCH.MAX_LENGTH).optional(),
});

export type WorkspaceDropdownFilters = z.infer<typeof workspaceDropdownSchema>;
