import { LevelCode } from "../LevelCode";

export interface WorldFilter {
    world: number;
    isChallenge: boolean;
    isBonus: boolean;
}

const WORLD_FILTER_REGEX = /([Bb]?)(\d+)([Cc]?)/;

export function parseWorldFilter(filter: string): WorldFilter | null {
    filter = filter.toLowerCase().trimStart().trimEnd();
    let match = filter.match(WORLD_FILTER_REGEX);
    if (!match) return null;
    let isBonus = match[1].length == 1;
    let world = parseInt(match[2]);
    let isChallenge = match[3].length == 1;

    if (isNaN(world)) return null;
    return { world, isChallenge, isBonus };
}

export function parseManyWorldFilters(filters: string): WorldFilter[] {
    return filters
        .split(",")
        .map((s) => parseWorldFilter(s))
        .filter((s) => s !== null) as WorldFilter[];
}

export function codeMatchesWorldFilter(code: LevelCode, filter: WorldFilter): boolean {
    return (
        code.world === filter.world &&
        code.isChallenge === filter.isChallenge &&
        code.isBonus === filter.isBonus
    );
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
    return `${filter.isBonus ? "B" : ""}${filter.world}${filter.isChallenge ? "c" : ""}`;
}

export function formatManyWorldFilters(filters: WorldFilter[]) {
    return filters.map(formatWorldFilter).join(", ");
}
