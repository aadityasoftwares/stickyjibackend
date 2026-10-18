import { z } from "zod";
import { Types } from "mongoose";
import { paginationShape } from "../../../utils/pagination.util.js";
import { WORKSPACE_MEMBER_INVITATION_CONSTANTS as C } from "../constants/workspaceMemberInvitation.constants.js";
import { WorkspaceMemberInvitationMessages as M } from "../constants/workspaceMemberInvitation.messages.js";
import { WorkspaceInvitationStatus } from "../constants/workspaceMemberInvitation.enums.js";

const objectId = z
    .union([z.string(), z.instanceof(Types.ObjectId)])
    .transform((value) => value.toString())
    .pipe(z.string().regex(/^[a-fA-F0-9]{24}$/, M.INVALID_ROLE_ID));
const message = z.string().trim().max(C.MESSAGE.MAX_LENGTH, M.INVALID_MESSAGE).nullable().optional();
const item = z
    .object({
        email: z
            .string()
            .trim()
            .toLowerCase()
            .max(C.EMAIL.MAX_LENGTH)
            .regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, M.INVALID_EMAIL),
        roleId: objectId,
        message,
    })
    .strict();
export const invitationCreateSchema = z
    .union([
        item.extend({ workspaceId: objectId }),
        z
            .object({
                workspaceId: objectId,
                invitations: z
                    .array(item)
                    .min(1, M.INVITATIONS_REQUIRED)
                    .max(C.BATCH.MAX_INVITATIONS, M.TOO_MANY_INVITATIONS),
            })
            .strict(),
    ])
    .superRefine((value, ctx) => {
        if (
            "invitations" in value &&
            new Set(value.invitations.map((item) => item.email)).size !== value.invitations.length
        ) {
            ctx.addIssue({ code: "custom", path: ["invitations"], message: M.DUPLICATE_EMAIL_IN_REQUEST });
        }
    });
export const invitationUpdateSchema = z
    .object({
        roleId: objectId.optional(),
        message,
        expiresAt: z
            .union([z.string(), z.date()])
            .refine((value) => new Date(value).getTime() > Date.now(), M.INVALID_EXPIRY_DATE)
            .optional(),
    })
    .strict()
    .refine((value) => Object.values(value).some((value) => value !== undefined), M.UPDATE_REQUIRED);
export const invitationTokenSchema = z
    .object({
        token: z
            .string()
            .trim()
            .length(C.TOKEN.RAW_BYTES * 2)
            .regex(/^[a-fA-F0-9]+$/, M.INVALID_INVITATION_TOKEN),
    })
    .strict();
export const invitationListSchema = z
    .object({
        ...paginationShape,
        limit: paginationShape.limit.default(C.PAGINATION.DEFAULT_LIMIT),
        workspaceId: objectId.optional(),
        userId: objectId.optional(),
        roleId: objectId.optional(),
        invitedBy: objectId.optional(),
        email: z.string().trim().toLowerCase().max(C.EMAIL.MAX_LENGTH).optional(),
        status: z.enum(WorkspaceInvitationStatus).optional(),
        sortBy: z.enum(["createdAt", "updatedAt", "expiresAt", "acceptedAt", "email", "status"]).default("createdAt"),
        sortOrder: z.enum(["asc", "desc"]).default("desc"),
    })
    .strict();
