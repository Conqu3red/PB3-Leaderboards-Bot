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
    await cacheManager.campaignManager.maybeReload();

    for (const level of cacheManager.campaignManager.campaignLevels) {
        const boards = await level.get();
        const board = selectLeaderboard(boards, type);
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
