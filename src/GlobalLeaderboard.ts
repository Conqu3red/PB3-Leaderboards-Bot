import { LeaderboardType } from "./LeaderboardInterface";
import { cacheManager } from "./resources/CacheManager";
import { CampaignLevel } from "./resources/CampaignLevel";
import { WeeklyLevel } from "./resources/WeeklyLevel";
import { CanvasTable, CTConfig, CTData, CTColumn } from "canvas-table";
import { createCanvas } from "canvas";
import { N_ENTRIES } from "./Consts";
import { codeMatchesWorldFilters } from "./utils/WorldFilter";
import SteamUsernames from "./resources/SteamUsernameHandler";
import { FormatScore } from "./utils/Format";
import rankToScore from "../json/rank_to_score.json";
import { World } from "./LevelCode";

export type LevelCategory = "all" /* | "weekly"*/;
export type ScoringMode = "rank" | "score";

const levelFilters = {
    all: (level: CampaignLevel) => true,
    weekly: (level: WeeklyLevel) => true,
};

export interface GlobalEntry {
    steam_id_user: string;
    value: number;
    rank: number;
}

export interface GlobalOptions {
    type: LeaderboardType;
    levelCategory: LevelCategory;
    scoringMode: ScoringMode;
    worldFilters?: World[];
}

export const defaultOptions: GlobalOptions = {
    type: "any",
    levelCategory: "all",
    scoringMode: "rank",
};

async function collateBoards(
    levels: CampaignLevel[],
    options: GlobalOptions
): Promise<GlobalEntry[]> {
    let userScores: Map<string, GlobalEntry> = new Map();
    let startScore = 0;

    const isRank = options.scoringMode === "rank";
    if (isRank) startScore = levels.length * 100;
    else
        startScore =
            options.type === "stress"
                ? levels.length * 10_000
                : levels.reduce((a, b) => a + b.info.budget, 0) * 2;

    for (const level of levels) {
        const board = level.get(options.type);
        for (const score of board.top1000) {
            let entry = userScores.get(score.steam_id_user) ?? {
                steam_id_user: score.steam_id_user,
                value: startScore,
                rank: NaN,
            };

            if (isRank) entry.value -= 100 - (rankToScore[score.rank - 1] ?? 100);
            else
                entry.value -=
                    options.type === "stress"
                        ? 10_000 - score.score
                        : level.info.budget * 2 - score.score;
            userScores.set(score.steam_id_user, entry);
        }
    }

    // Sort and compute ranks

    let results = [...userScores.values()].sort((a, b) => a.value - b.value);

    for (let i = 0; i < results.length; i++) {
        results[i].rank = i + 1;
        if (i > 0 && results[i - 1].value == results[i].value) {
            results[i].rank = results[i - 1].rank; // propagate tied rank
        }
    }

    return results;
}

export async function globalLeaderboard(options?: GlobalOptions): Promise<GlobalEntry[] | null> {
    options = options ?? defaultOptions;
    let levelFilter = levelFilters[options.levelCategory];
    let campaignLevels = cacheManager.campaignManager.campaignLevels.filter(levelFilter);
    if (options && options.worldFilters && options.worldFilters.length > 0) {
        campaignLevels = campaignLevels.filter((level) =>
            codeMatchesWorldFilters(level.info.code, options?.worldFilters ?? [])
        );
    }
    return await collateBoards(campaignLevels, options);
}

export function findUser(board: GlobalEntry[], userID: string): GlobalEntry | null {
    for (const score of board) {
        if (score.steam_id_user == userID) {
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
    options = options ?? defaultOptions;
    const canvas = createCanvas(300, 350);

    let title = "Score";
    if (options.scoringMode !== "rank") {
        title = options.type === "stress" ? "Stress" : "Spent";
    }

    const columns: CTColumn[] = [
        { title: "#", options: { color: "#ffffff", textAlign: "right" } },
        { title: "Name", options: { color: "#ffffff", maxWidth: 150 } },
        {
            title,
            options: { color: "#ffffff", textAlign: "right" },
        },
    ];

    let page_index = Math.floor(index / N_ENTRIES);
    let chosen_entries = entries.slice(page_index * N_ENTRIES, (page_index + 1) * N_ENTRIES);

    const data: CTData = chosen_entries.map((entry) => [
        entry.rank.toString(),
        SteamUsernames.get(entry.steam_id_user),
        options?.scoringMode === "rank"
            ? entry.value.toLocaleString("en-US")
            : FormatScore(entry.value, options?.type ?? "any"),
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
