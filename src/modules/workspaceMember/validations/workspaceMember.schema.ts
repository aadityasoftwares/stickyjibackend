import { z } from "zod";
import { paginationShape } from "../../../utils/pagination.util.js";
import { WorkspaceMemberStatus } from "../constants/workspaceMember.enums.js";
import { WorkspaceMemberMessages } from "../constants/workspaceMember.messages.js";
import { WORKSPACE_MEMBER_CONSTANTS } from "../constants/workspaceMember.constants.js";

const objectIdRegex = /^[a-fA-F0-9]{24}$/;

export const createWorkspaceMemberSchema = z.strictObject({
    workspaceId: z.string().regex(objectIdRegex, { message: WorkspaceMemberMessages.INVALID_WORKSPACE_ID }),
    userId: z.string().regex(objectIdRegex, { message: WorkspaceMemberMessages.INVALID_USER_ID }),
    roleId: z.string().regex(objectIdRegex, { message: WorkspaceMemberMessages.INVALID_ROLE_ID }),
});

export const updateWorkspaceMemberSchema = z.strictObject({
    roleId: z.string().regex(objectIdRegex, { message: WorkspaceMemberMessages.INVALID_ROLE_ID }),
});

export const workspaceMemberListSchema = z
    .strictObject({
        ...paginationShape,
        workspaceId: z.string().regex(objectIdRegex, { message: WorkspaceMemberMessages.INVALID_WORKSPACE_ID }),
        userId: z
            .string()
            .regex(objectIdRegex, { message: WorkspaceMemberMessages.INVALID_USER_ID })
            .optional(),
        roleId: z
            .string()
            .regex(objectIdRegex, { message: WorkspaceMemberMessages.INVALID_ROLE_ID })
            .optional(),
        status: z.enum(WorkspaceMemberStatus).optional(),
        search: z.string().trim().max(WORKSPACE_MEMBER_CONSTANTS.SEARCH.MAX_LENGTH).optional(),
        sortBy: z
            .enum(["createdAt", "updatedAt", "joinedAt", "status"])
            .default(WORKSPACE_MEMBER_CONSTANTS.DEFAULT_SORT_BY),
        sortOrder: z.enum(["asc", "desc"]).default(WORKSPACE_MEMBER_CONSTANTS.DEFAULT_SORT_ORDER),
    })
    .refine((value) => Number.isSafeInteger((value.page - 1) * value.limit), {
        path: ["page"],
        message: "Pagination offset exceeds the supported range.",
    });

export type WorkspaceMemberListFilters = z.infer<typeof workspaceMemberListSchema>;
