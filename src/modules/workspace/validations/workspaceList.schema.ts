import { z } from "zod";
import { paginationShape } from "../../../utils/pagination.util.js";
import { listSortSchema } from "../../../utils/sorting.util.js";
import { WORKSPACE_CONSTANTS } from "../constants/workspace.constants.js";
import { WorkspaceAccessFilter, WorkspaceStatus, WorkspaceVisibility } from "../constants/workspace.enums.js";

export const workspaceListSchema = z
    .strictObject({
        ...paginationShape,
        access: z.enum(WorkspaceAccessFilter).default(WorkspaceAccessFilter.ALL),
        status: z
            .enum([
                WorkspaceStatus.ACTIVE,
                WorkspaceStatus.ARCHIVED,
                WorkspaceStatus.TRASHED,
                WorkspaceStatus.DELETED,
                "ALL",
            ])
            .default(WorkspaceStatus.ACTIVE),
        search: z.string().trim().max(WORKSPACE_CONSTANTS.SEARCH.MAX_LENGTH).optional(),
        sortBy: z
            .union([listSortSchema, z.enum(WORKSPACE_CONSTANTS.SORT_FIELDS)])
            .default("RECENTLY_CREATED"),
        sortOrder: z.enum(["asc", "desc"]).optional(),
        visibility: z.enum(WorkspaceVisibility).optional(),
        isPersonal: z.boolean().optional(),
        // Retained for legacy POST clients; it never overrides authenticated access.
        ownerId: z
            .string()
            .regex(/^[a-fA-F0-9]{24}$/)
            .optional(),
    })
    .refine((value) => Number.isSafeInteger((value.page - 1) * value.limit), {
        path: ["page"],
        message: "Pagination offset exceeds the supported range.",
    });

export type WorkspaceListFilters = z.infer<typeof workspaceListSchema>;
