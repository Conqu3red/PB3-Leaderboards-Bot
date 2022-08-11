import { LeaderboardType, LevelLeaderboards } from "./LeaderboardInterface";
import { Remote } from "./RemoteLeaderboardInterface";
import { cacheManager } from "./resources/CacheManager";
import { CampaignLevel } from "./resources/CampaignLevel";
import rankToScore from "../json/rank_to_score.json";

type LevelCategory = "all" | "regular" | "challenge"; // TODO: add "weekly"

const levelFilters = {
    all: (level: CampaignLevel) => true,
    regular: (level: CampaignLevel) => !level.info.code.isChallenge,
    challenge: (level: CampaignLevel) => level.info.code.isChallenge,
};

export interface GlobalEntry {
    user: Remote.User;
    value: number;
    rank: number;
}

export interface GlobalOptions {
    type: LeaderboardType;
    levelCategory: LevelCategory;
    byRawScore: boolean;
}

export function selectLeaderboard(level: LevelLeaderboards, type: LeaderboardType) {
    return type == "any" ? level.any : level.unbroken;
}

export async function globalLeaderboard(options?: GlobalOptions): Promise<GlobalEntry[]> {
    options = options ?? { type: "any", levelCategory: "all", byRawScore: false };

    let levelFilter = levelFilters[options.levelCategory];

    await cacheManager.campaignManager.maybeReload();
    let levels = cacheManager.campaignManager.campaignLevels.filter(levelFilter);
    let userScores: Map<string, GlobalEntry> = new Map();

    const startScore = options.byRawScore
        ? levels.reduce((a, b) => a + b.info.budget, 0)
        : 100 * levels.length;
    // TODO: option for moneyspent

    for (const level of levels) {
        const boards = await level.get();
        const board = selectLeaderboard(boards, options.type);
        for (const score of board.top1000) {
            let entry = userScores.get(score.owner.id) ?? {
                user: score.owner,
                value: startScore,
                rank: NaN,
            };

            entry.value -= options.byRawScore
                ? level.info.budget - score.value
                : 100 - rankToScore[score.rank - 1];
            userScores.set(score.owner.id, entry);
        }
    }

    // Sort and compute ranks

    let sorted = [...userScores.values()].sort((a, b) => a.value - b.value);

    let results: GlobalEntry[] = [];
    for (let i = 0; i < sorted.length; i++) {
        let entry = sorted[i];
        entry.rank = i + 1;

        if (i > 0 && sorted[i - 1].value == sorted[i].value) {
            entry.rank = sorted[i - 1].rank; // propagate tied rank
        }

        results.push(entry);
    }

    return results;
}
