import { findUser, GlobalEntry, globalLeaderboard } from "./GlobalLeaderboard";
import { LeaderboardEntry, LeaderboardType } from "./LeaderboardInterface";
import { cacheManager } from "./resources/CacheManager";
import { CampaignLevel } from "./resources/CampaignLevel";
import { BaseLevel } from "./resources/Level";
import { CanvasTable, CTConfig, CTData, CTColumn } from "canvas-table";
import { createCanvas } from "canvas";
import { N_ENTRIES } from "./Consts";
import { matchesUserFilter, UserFilter } from "./utils/userFilter";
import { FormatScore } from "./utils/Format";

export interface GlobalPositions {
    all_rank: GlobalEntry | null;
    all_score: GlobalEntry | null;
    weekly: GlobalEntry | null;
}

export interface ScoreCount {
    overall: number;
    weekly: number;
}

export interface ScoreCounts {
    [key: number]: ScoreCount;
}

export interface LevelScore {
    compactName: string;
    score: LeaderboardEntry | undefined;
}

export interface Stats {
    globalPositions: GlobalPositions;
    scoreCounts: ScoreCounts;
    levelScores: LevelScore[];
}

export interface Profile {
    steam_id_user: string;
    stats: Stats;
}

export interface Options {
    type: LeaderboardType;
}

export const defaultOptions: Options = {
    type: "any",
};

export const scoreCountThresholds = [1, 10, 100, 1000];

function isCampgainLevel(level: BaseLevel<any>): level is CampaignLevel {
    return (level as CampaignLevel).info.code !== undefined;
}

export async function getProfile(user: UserFilter, options?: Options): Promise<Profile | null> {
    options = options ?? defaultOptions;
    let owner: string | undefined = undefined;

    let levelScores: LevelScore[] = [];
    let scoreCounts: ScoreCounts = Object.fromEntries(
        scoreCountThresholds.map((value) => [value, { overall: 0, weekly: 0 }])
    );

    const levels = [...cacheManager.campaignManager.campaignLevels];

    for (const level of levels) {
        let board = level.get(options.type);

        let entry: LeaderboardEntry | undefined = undefined;
        for (const score of board.top1000) {
            if (!owner && matchesUserFilter(user, score.steam_id_user)) {
                owner = score.steam_id_user;
            }
            if (score.steam_id_user === owner) {
                entry = score;

                // Threshold processing
                for (const threshold of scoreCountThresholds) {
                    if (score.rank <= threshold) {
                        if (isCampgainLevel(level)) {
                            scoreCounts[threshold].overall += 1;
                        } else {
                            scoreCounts[threshold].weekly += 1;
                        }
                    }
                }

                break;
            }
        }

        levelScores.push({ compactName: level.compactName(), score: entry });
    }

    if (!owner) return null;

    const globalPositions: GlobalPositions = {
        all_rank: findUser(
            (await globalLeaderboard({
                levelCategory: "all",
                type: options.type,
                scoringMode: "rank",
            })) ?? [],
            owner
        ),
        all_score: findUser(
            (await globalLeaderboard({
                levelCategory: "all",
                type: options.type,
                scoringMode: "score",
            })) ?? [],
            owner
        ),
        weekly: null,
    };

    return {
        steam_id_user: owner,
        stats: {
            globalPositions,
            levelScores,
            scoreCounts,
        },
    };
}

export async function renderProfileLevelScores(
    entries: LevelScore[],
    index: number,
    options?: Options
): Promise<Buffer> {
    options = options ?? defaultOptions;
    const canvas = createCanvas(300, 350);

    const columns: CTColumn[] = [
        { title: "Level", options: { color: "#ffffff" } },
        { title: "#", options: { color: "#ffffff", textAlign: "right" } },
        {
            title: "Score",
            options: { color: "#ffffff", textAlign: "right" },
        },
        { title: "Breaks", options: { color: "#ffffff" } },
    ];

    let page_index = Math.floor(index / N_ENTRIES);
    let chosen_entries = entries.slice(page_index * N_ENTRIES, (page_index + 1) * N_ENTRIES);

    const data: CTData = chosen_entries.map((entry) => [
        entry.compactName,
        entry.score?.rank?.toString() ?? "",
        entry.score ? FormatScore(entry.score.score, options?.type ?? "any") : "",
        entry.score?.didBreak ? "✱" : "",
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
