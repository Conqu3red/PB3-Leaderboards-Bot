import { LeaderboardType } from "./LeaderboardInterface";
import { cacheManager } from "./resources/CacheManager";
import { WorldFilter, codeMatchesWorldFilters } from "./utils/WorldFilter";

export interface SumsOfBest {
    overall: number;
    levelCount: number;
}

export async function sumOfBest(
    type: LeaderboardType,
    worldFilters?: WorldFilter[]
): Promise<SumsOfBest> {
    let sumsOfBest: SumsOfBest = {
        overall: 0,
        levelCount: 0,
    };

    for (const level of cacheManager.campaignManager.campaignLevels) {
        if (
            worldFilters &&
            worldFilters.length > 0 &&
            !codeMatchesWorldFilters(level.info.code, worldFilters)
        ) {
            continue;
        }

        const board = level.get(type);
        if (board.top1000.length > 0) {
            sumsOfBest.overall += board.top1000[0].score;
            sumsOfBest.levelCount++;
        } else {
            sumsOfBest.overall += type === "stress" ? 10_000 : level.info.budget;
            sumsOfBest.levelCount++;
        }
    }

    return sumsOfBest;
}
