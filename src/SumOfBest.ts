import { selectLeaderboard } from "./GlobalLeaderboard";
import { LeaderboardType } from "./LeaderboardInterface";
import { cacheManager } from "./resources/CacheManager";
import { WorldFilter, codeMatchesWorldFilters } from "./utils/WorldFilter";

export interface SumsOfBest {
    overall: number;
    regular: number;
    challenge: number;
    bonus: number;
}

export async function sumOfBest(
    type: LeaderboardType,
    worldFilters?: WorldFilter[]
): Promise<SumsOfBest> {
    let sumsOfBest: SumsOfBest = {
        overall: 0,
        regular: 0,
        challenge: 0,
        bonus: 0,
    };

    for (const level of cacheManager.campaignManager.campaignLevels) {
        if (
            worldFilters &&
            worldFilters.length > 0 &&
            !codeMatchesWorldFilters(level.info.code, worldFilters)
        ) {
            continue;
        }

        const board = level.get(type === "unbroken");
        if (board.top1000.length > 0) {
            sumsOfBest.overall += board.top1000[0].score;
            if (level.info.code.isChallenge) {
                sumsOfBest.challenge += board.top1000[0].score;
            } else if (level.info.code.isBonus) {
                sumsOfBest.bonus += board.top1000[0].score;
            } else {
                sumsOfBest.regular += board.top1000[0].score;
            }
        }
    }

    return sumsOfBest;
}
