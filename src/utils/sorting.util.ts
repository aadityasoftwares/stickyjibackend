import { z } from "zod";

export const listSortSchema = z.enum([
    "RECENTLY_UPDATED", "RECENTLY_CREATED", "NAME_ASC", "NAME_DESC", "OLDEST_FIRST",
]);
export type ListSort = z.infer<typeof listSortSchema>;

const SORTS = {
    RECENTLY_UPDATED: { updatedAt: -1, _id: 1 },
    RECENTLY_CREATED: { createdAt: -1, _id: 1 },
    NAME_ASC: { name: 1, _id: 1 },
    NAME_DESC: { name: -1, _id: 1 },
    OLDEST_FIRST: { createdAt: 1, _id: 1 },
} as const;

export function buildListSort(sort: ListSort): Record<string, 1 | -1> {
    return { ...SORTS[sort] };
}
