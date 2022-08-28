import { LeaderboardEntry, LeaderboardType, LevelLeaderboards } from "./LeaderboardInterface";
import { Remote } from "./RemoteLeaderboardInterface";
import { cacheManager } from "./resources/CacheManager";
import { CampaignLevel } from "./resources/CampaignLevel";
import rankToScore from "../json/rank_to_score.json";
import { BaseLevel } from "./resources/Level";
import { WeeklyLevel } from "./resources/WeeklyLevel";
import { CanvasTable, CTConfig, CTData, CTColumn } from "canvas-table";
import { createCanvas } from "canvas";
import { N_ENTRIES } from "./Consts";

export type LevelCategory = "all" | "regular" | "challenge" | "weekly"; // TODO: add "weekly"

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
    isValidOptions(options: GlobalOptions): boolean;
    baseScore(levels: T[]): number;
    getLevelSubtractScore(level: T, score: LeaderboardEntry, options: GlobalOptions): number;
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

export type GlobalScoreComputerType = "rank" | "moneyspent";

export const globalScoreComputers = {
    rank: GlobalScoreByRank,
    moneyspent: GlobalScoreByBudget,
};

export interface GlobalOptions {
    type: LeaderboardType;
    levelCategory: LevelCategory;
    scoreComputer: GlobalScoreComputerType;
}

function globalOptionsOrDefault(options?: GlobalOptions): GlobalOptions {
    return Object.assign(
        {
            type: "any",
            levelCategory: "all",
            scoreComputer: "rank",
        },
        options
    );
}

export function selectLeaderboard(level: LevelLeaderboards, type: LeaderboardType) {
    return type == "any" ? level.any : level.unbroken;
}

async function collateBoards<T extends BaseLevel<any>>(
    levels: T[],
    options: GlobalOptions
): Promise<GlobalEntry[]> {
    let userScores: Map<string, GlobalEntry> = new Map();
    let scoreComputer: GlobalScoreComputer<T> = globalScoreComputers[options.scoreComputer];
    const startScore = scoreComputer.baseScore(levels);
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

            entry.value -= scoreComputer.getLevelSubtractScore(level, score, options);
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

export async function globalLeaderboard(options?: GlobalOptions): Promise<GlobalEntry[] | null> {
    let actualOptions = globalOptionsOrDefault(options);
    let scoreComputer = globalScoreComputers[actualOptions.scoreComputer];

    if (!scoreComputer.isValidOptions(actualOptions)) {
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

export function findUser(board: GlobalEntry[], userID: string): GlobalEntry | null {
    for (const score of board) {
        if (score.user.id == userID) {
            return score;
        }
    }

    return null;
}

export async function renderGlobal(
    entries: GlobalEntry[],
    index: number,
    options?: GlobalOptions
): Promise<Buffer> {
    options = globalOptionsOrDefault(options);
    const canvas = createCanvas(300, 350);
    const isMoneySpent = options.scoreComputer === "moneyspent";

    const columns: CTColumn[] = [
        { title: "#", options: { color: "#ffffff", textAlign: "right" } },
        { title: "Name", options: { color: "#ffffff", maxWidth: 150 } },
        {
            title: isMoneySpent ? "Spent" : "Score",
            options: { color: "#ffffff", textAlign: "right" },
        },
    ];

    let page_index = Math.floor(index / N_ENTRIES);
    let chosen_entries = entries.slice(page_index * N_ENTRIES, (page_index + 1) * N_ENTRIES);

    const data: CTData = chosen_entries.map((entry) => [
        entry.rank.toString(),
        entry.user.display_name,
        (isMoneySpent ? "$" : "") + entry.value.toLocaleString("en-US"),
    ]);

    // fit: true
    const config: CTConfig = {
        columns,
        data,
        options: {
            background: "#1e2124",
            header: {
                color: "#ffffff",
            },
            fit: true,
            fader: undefined,
            padding: {
                top: 10,
                bottom: 10,
                left: 10,
                right: 10,
            },
        },
    };
    const ct = new CanvasTable(canvas, config);
    await ct.generateTable();
    return await ct.renderToBuffer();
}
