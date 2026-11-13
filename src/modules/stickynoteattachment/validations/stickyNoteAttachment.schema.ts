import { z } from "zod";

export const attachmentParamsSchema = z.object({
    noteId: z.string().regex(/^[a-f\d]{24}$/i),
    attachmentId: z
        .string()
        .regex(/^[a-f\d]{24}$/i)
        .optional(),
});
export const attachmentUploadSchema = z
    .object({
        fileName: z.string().trim().min(1).max(255),
        mimeType: z.string().trim().toLowerCase().min(1).max(150),
        size: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
        idempotencyKey: z
            .string()
            .regex(/^[\w-]{8,100}$/)
            .optional(),
    })
    .strict();
export const attachmentListSchema = z.object({
    page: z.coerce.number().int().min(1).max(100000).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
});
