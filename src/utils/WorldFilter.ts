import { LevelCode } from "../LevelCode";

export interface WorldFilter {
    world: string;
}

const WORLD_FILTER_REGEX = /(CR|MM|RB|BB|VT|LL|RMT|SC|DS|TT)/i;

export function parseWorldFilter(filter: string): WorldFilter | null {
    filter = filter.toUpperCase().trimStart().trimEnd();
    let match = filter.match(WORLD_FILTER_REGEX);
    if (!match) return null;
    let world = match[1];
    return { world };
}

export function parseManyWorldFilters(filters: string): WorldFilter[] {
    return filters
        .split(",")
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
