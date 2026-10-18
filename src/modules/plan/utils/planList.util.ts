import { buildListSort, listSortSchema } from "../../../utils/sorting.util.js";
import type { PlanListFilters } from "../validations/planList.schema.js";

export function planListSort(filters: PlanListFilters): Record<string, 1 | -1> {
    const preset = listSortSchema.safeParse(filters.sortBy);
    if (preset.success) return buildListSort(preset.data);

    const direction: 1 | -1 = filters.sortOrder === "desc" ? -1 : 1;
    return { [filters.sortBy]: direction, _id: 1 };
}
