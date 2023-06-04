import { LevelCode, World, isWorld } from "../LevelCode";

export function parseWorldFilter(filter: string): World | null {
    filter = filter.toUpperCase().replace(/\s/g, "");
    if (!isWorld(filter)) return null;
    return filter;
}

export function parseManyWorldFilters(filters: string): World[] {
    return filters
        .split(/[\s,]+/)
        .map((s) => parseWorldFilter(s))
        .filter((s) => s !== null) as World[];
}

export function codeMatchesWorldFilter(code: LevelCode, filter: World): boolean {
    return code.world === filter;
}

export function codeMatchesWorldFilters(code: LevelCode, filters: World[]): boolean {
    for (const filter of filters) {
        if (codeMatchesWorldFilter(code, filter)) {
            return true;
        }
    }

    return false;
}
