import { LeaderboardEntry, LeaderboardType, LevelLeaderboards } from "./LeaderboardInterface";
import { Remote } from "./RemoteLeaderboardInterface";
import { cacheManager } from "./resources/CacheManager";
import { CampaignLevel } from "./resources/CampaignLevel";
import rankToScore from "../json/rank_to_score.json";
import { BaseLevel } from "./resources/Level";
import { WeeklyLevel } from "./resources/WeeklyLevel";

type LevelCategory = "all" | "regular" | "challenge" | "weekly"; // TODO: add "weekly"

const levelFilters = {
    all: (level: CampaignLevel) => true,
    regular: (level: CampaignLevel) => !level.info.code.isChallenge,
    challenge: (level: CampaignLevel) => level.info.code.isChallenge,
    weekly: (level: WeeklyLevel) => true,
};

export interface GlobalEntry {
    user: Remote.User;
    value: number;
    rank: number;
}

export interface GlobalScoreComputer<T extends BaseLevel<any>> {
    isValidOptions(options: GlobalOptions<T>): boolean;
    baseScore(levels: T[]): number;
    getLevelSubtractScore(level: T, score: LeaderboardEntry, options: GlobalOptions<T>): number;
}

export const GlobalScoreByRank: GlobalScoreComputer<CampaignLevel | WeeklyLevel> = {
    isValidOptions(options) {
        return true;
    },
    baseScore(levels) {
        return 100 * levels.length;
    },
    getLevelSubtractScore(level, score, options) {
        return 100 - rankToScore[score.rank - 1];
    },
};

export const GlobalScoreByBudget: GlobalScoreComputer<CampaignLevel> = {
    isValidOptions(options) {
        return options.levelCategory !== "weekly";
    },
    baseScore(levels) {
        return levels.reduce((a, b) => a + b.info.budget, 0);
    },
    getLevelSubtractScore(level, score, options) {
        return level.info.budget - score.value;
    },
};

export interface GlobalOptions<T extends BaseLevel<any>> {
    type: LeaderboardType;
    levelCategory: LevelCategory;
    scoreComputer: GlobalScoreComputer<T>;
}

export function selectLeaderboard(level: LevelLeaderboards, type: LeaderboardType) {
    return type == "any" ? level.any : level.unbroken;
}

async function collateBoards<T extends BaseLevel<any>>(
    levels: T[],
    options: GlobalOptions<T>
): Promise<GlobalEntry[]> {
    let userScores: Map<string, GlobalEntry> = new Map();

    const startScore = options.scoreComputer.baseScore(levels);
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

            entry.value -= options.scoreComputer.getLevelSubtractScore(level, score, options);
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

export async function globalLeaderboard<T extends BaseLevel<any>>(
    options?: GlobalOptions<T>
): Promise<GlobalEntry[] | null> {
    let actualOptions = options ?? {
        type: "any",
        levelCategory: "all",
        scoreComputer: GlobalScoreByRank,
    };

    if (!actualOptions.scoreComputer.isValidOptions(actualOptions)) {
        return null;
    }

    if (actualOptions.levelCategory !== "weekly") {
        let levelFilter = levelFilters[actualOptions.levelCategory];
        await cacheManager.campaignManager.maybeReload();
        let campaignLevels = cacheManager.campaignManager.campaignLevels.filter(levelFilter);
        return await collateBoards(campaignLevels, actualOptions);
    } else {
        let levelFilter = levelFilters[actualOptions.levelCategory];
        await cacheManager.weeklyManager.maybeReload();
        let weeklyLevels = cacheManager.weeklyManager.weeklyLevels.filter(levelFilter);
        return await collateBoards(weeklyLevels, actualOptions);
    }
}
