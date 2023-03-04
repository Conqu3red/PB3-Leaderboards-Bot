import { selectLeaderboard } from "./GlobalLeaderboard";
import { LeaderboardType } from "./LeaderboardInterface";
import { cacheManager } from "./resources/CacheManager";

export interface SumsOfBest {
    overall: number;
    regular: number;
    challenge: number;
}

export async function sumOfBest(type: LeaderboardType): Promise<SumsOfBest> {
    let sumsOfBest: SumsOfBest = {
        overall: 0,
        regular: 0,
        challenge: 0,
    };

    for (const level of cacheManager.campaignManager.campaignLevels) {
        const board = level.get(type === "unbroken");
        if (board.top1000.length > 0) {
            sumsOfBest.overall += board.top1000[0].value;
            if (level.info.code.isChallenge) {
                sumsOfBest.challenge += board.top1000[0].value;
            } else {
                sumsOfBest.regular += board.top1000[0].value;
            }
        }
    }

    return sumsOfBest;
}
