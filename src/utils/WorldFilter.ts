import { GameFilter } from "../LeaderboardInterface";
import { LevelCode, WORLDS, World, isWorld } from "../LevelCode";

export const VALID_WORLDFILTER_STRINGS = [...WORLDS, "1C", "2C", "3C", "4C", "5C", "6C"]

export const GAME_WORLDFILTERS: Record<GameFilter, string[]> = {
    "all": [],
    "pb2": ["1", "2", "3", "4", "5", "6", "1C", "2C", "3C", "4C", "5C", "6C", "B1", "B2"],
    "pb3": ["CR", "MM", "RB", "BB", "VT", "LL", "RMT", "SC", "DS", "FD", "TT", "RTA", "AT", "FR"]
}

export interface WorldFilter {
    world: string;
    challenge: boolean;
}

export function parseWorldFilter(filter: string): WorldFilter | null {
    filter = filter.toUpperCase().replace(/\s/g, "");
    if (!VALID_WORLDFILTER_STRINGS.includes(filter)) return null;
    const match = filter.match(/(\d+|B\d|[a-z]+)(C?)/)
    if (!match) return null;
    return {world: match[1], challenge: match[2].length > 0}
}

export function parseManyWorldFilters(filters: string): WorldFilter[] {
    return filters
        .split(/[\s,]+/)
        .map((s) => parseWorldFilter(s))
        .filter((s) => s !== null) as WorldFilter[];
}

export function codeMatchesWorldFilter(code: LevelCode, filter: WorldFilter): boolean {
    return (code.world === filter.world && code.challenge == filter.challenge);
}

export function codeMatchesWorldFilters(code: LevelCode, filters: WorldFilter[]): boolean {
    for (const filter of filters) {
        if (codeMatchesWorldFilter(code, filter)) {
            return true;
        }
    }

    return false;
}

export function formatWorldFilter(world: WorldFilter | null): string {
    if (!world) return "";
    return `${world.world}${world.challenge ? "C" : ""}`;
}