import { z } from "zod";
import { paginationShape } from "../../../utils/pagination.util.js";
import { WORKSPACE_FOLDER_CONSTANTS as C } from "../constants/workspaceFolder.constants.js";
import { WorkspaceFolderStatus } from "../constants/workspaceFolder.enums.js";
import { WorkspaceFolderValidation as V } from "./workspaceFolder.validation.js";

export const folderIdSchema = z.string().regex(/^[a-fA-F0-9]{24}$/);
const fields = {
    name: z.string().transform(V.normalizeName).pipe(z.string().min(C.NAME.MIN_LENGTH).max(C.NAME.MAX_LENGTH)),
    slug: z.string().transform(V.normalizeSlug).pipe(z.string().min(C.SLUG.MIN_LENGTH).max(C.SLUG.MAX_LENGTH)
        .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)).optional(),
    description: z.string().trim().max(C.DESCRIPTION.MAX_LENGTH).nullable().optional(),
    icon: z.string().trim().max(C.ICON.MAX_LENGTH).nullable().optional(),
    color: z.string().trim().max(C.COLOR.MAX_LENGTH).refine(V.isValidColor).nullable().optional(),
    position: z.number().int().min(C.POSITION.MIN).optional(),
};
export const createFolderSchema = z.strictObject({ workspaceId: folderIdSchema, ...fields,
    slug: fields.slug.nullable().transform(value => value ?? undefined),
});
export const updateFolderSchema = z.strictObject(fields).partial().refine(value => Object.keys(value).length > 0);
export const folderStatusSchema = z.strictObject({
    status: z.enum([WorkspaceFolderStatus.ACTIVE, WorkspaceFolderStatus.INACTIVE, WorkspaceFolderStatus.ARCHIVED]),
});
export const folderListSchema = z.strictObject({
    ...paginationShape,
    workspaceId: folderIdSchema.optional(),
    search: z.string().trim().max(C.SEARCH.MAX_LENGTH).optional(),
    status: z.enum([...Object.values(WorkspaceFolderStatus), "ALL"]).optional(),
    isDefault: z.boolean().optional(),
    createdBy: folderIdSchema.optional(),
    sortBy: z.enum(C.SORT_FIELDS).default(C.DEFAULT_SORT_BY),
    sortOrder: z.enum(["asc", "desc"]).default(C.DEFAULT_SORT_ORDER),
}).refine(value => Number.isSafeInteger((value.page - 1) * value.limit), {
    path: ["page"], message: "Pagination offset exceeds the supported range.",
});
