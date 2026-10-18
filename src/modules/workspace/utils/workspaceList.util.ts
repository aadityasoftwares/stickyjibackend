import { buildListSort, listSortSchema } from "../../../utils/sorting.util.js";
import type { WorkspaceListFilters } from "../validations/workspaceList.schema.js";

export function workspaceListSort(filters: WorkspaceListFilters): Record<string, 1 | -1> {
    const preset = listSortSchema.safeParse(filters.sortBy);
    if (preset.success) return buildListSort(preset.data);

    return { [filters.sortBy]: filters.sortOrder === "asc" ? 1 : -1, _id: 1 };
}
