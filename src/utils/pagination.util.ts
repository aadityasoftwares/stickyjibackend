import { z } from "zod";

export const PAGINATION_DEFAULTS = { page: 1, limit: 20, maxLimit: 100 } as const;

const positiveInteger = z.union([
    z.number(),
    z.string().trim().regex(/^\d+$/).transform(Number),
]).pipe(z.number().int().positive().max(Number.MAX_SAFE_INTEGER));

export const paginationShape = {
    page: positiveInteger.default(PAGINATION_DEFAULTS.page),
    limit: positiveInteger.transform(value => Math.min(value, PAGINATION_DEFAULTS.maxLimit))
        .default(PAGINATION_DEFAULTS.limit),
};

export function getPagination(page: number, limit: number) {
    const skip = (page - 1) * limit;
    if (!Number.isSafeInteger(skip)) {
        throw new RangeError("Pagination offset exceeds the supported range.");
    }
    return { skip, limit };
}

export function paginationMeta(page: number, limit: number, total: number) {
    return { page, limit, total, totalPages: Math.ceil(total / limit) };
}
