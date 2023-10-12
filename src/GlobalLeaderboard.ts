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

export type LevelCategory = "all" | "weekly";
export type ScoringMode = "rank" | "score";

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
    week?: number;
}

export const defaultOptions: GlobalOptions = {
    type: "any",
    levelCategory: "all",
    scoringMode: "rank",
};

function grouping(baseScore: number, baseRank: number, repeat: number, rank: number) {
    return baseScore + Math.floor((rank - baseRank) / repeat);
}

export function convertRankToScore(r: number) {
    if (r <= 10) return r;
    else if (r <= 50) return grouping(11, 11, 4, r);
    else if (r <= 100) return grouping(21, 51, 5, r);
    else if (r <= 400) return grouping(31, 101, 10, r);
    else if (r <= 1000) return grouping(61, 401, 20, r);
    return 100;
}

async function collateBoards(
    levels: (CampaignLevel | WeeklyLevel)[],
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

            if (isRank) entry.value -= 100 - convertRankToScore(score.rank);
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
    let levels: (CampaignLevel | WeeklyLevel)[] =
        options.levelCategory == "all"
            ? cacheManager.campaignManager.campaignLevels
            : cacheManager.campaignManager.weeklyLevels;

    if (
        options &&
        options.worldFilters &&
        options.worldFilters.length > 0 &&
        options.levelCategory == "all"
    ) {
        levels = (levels as CampaignLevel[]).filter((level) =>
            codeMatchesWorldFilters(level.info.code, options?.worldFilters ?? [])
        );
    }
    if (options && options.week && options.levelCategory == "weekly") {
        levels = (levels as WeeklyLevel[]).filter((level) => level.info.week == options?.week);
    }
    return await collateBoards(levels, options);
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
