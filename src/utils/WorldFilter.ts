import { LevelCode, World, isWorld } from "../LevelCode";

export interface WorldFilter {
    world: World;
}

export function parseWorldFilter(filter: string): WorldFilter | null {
    filter = filter.toUpperCase().replace(/\s/g, "");
    if (!isWorld(filter)) return null;
    return { world: filter };
}

export function parseManyWorldFilters(filters: string): WorldFilter[] {
    return filters
        .split(/[\s,]+/)
        .map((s) => parseWorldFilter(s))
        .filter((s) => s !== null) as WorldFilter[];
}

export function codeMatchesWorldFilter(code: LevelCode, filter: WorldFilter): boolean {
    return code.world === filter.world;
}

export function codeMatchesWorldFilters(code: LevelCode, filters: WorldFilter[]): boolean {
    for (const filter of filters) {
        if (codeMatchesWorldFilter(code, filter)) {
            return true;
        }
    }

    return false;
}

export function formatWorldFilter(filter: WorldFilter) {
    return `${filter.world}`;
}

export function formatManyWorldFilters(filters: WorldFilter[]) {
    return filters.map(formatWorldFilter).join(", ");
}
