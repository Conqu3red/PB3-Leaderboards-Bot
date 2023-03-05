import { findUser, GlobalEntry, globalLeaderboard, selectLeaderboard } from "./GlobalLeaderboard";
import { LeaderboardEntry, LeaderboardType } from "./LeaderboardInterface";
import { Remote } from "./RemoteLeaderboardInterface";
import { cacheManager } from "./resources/CacheManager";
import { CampaignLevel } from "./resources/CampaignLevel";
import { BaseLevel } from "./resources/Level";
import { CanvasTable, CTConfig, CTData, CTColumn } from "canvas-table";
import { createCanvas } from "canvas";
import { N_ENTRIES } from "./Consts";
import { matchesUserFilter, UserFilter } from "./utils/userFilter";

export interface GlobalPositions {
    all: GlobalEntry | null;
    regular: GlobalEntry | null;
    challenge: GlobalEntry | null;
    weekly: GlobalEntry | null;
}

export interface ScoreCount {
    overall: number;
    regular: number;
    challenge: number;
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
    user: Remote.User;
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
    options = Object.assign(defaultOptions, options);
    let owner: Remote.User | undefined = undefined;

    let levelScores: LevelScore[] = [];
    let scoreCounts: ScoreCounts = Object.fromEntries(
        scoreCountThresholds.map((value) => [
            value,
            { overall: 0, regular: 0, challenge: 0, weekly: 0 },
        ])
    );

    const levels = [
        ...cacheManager.campaignManager.campaignLevels,
        ...cacheManager.weeklyManager.weeklyLevels,
    ];

    for (const level of levels) {
        let board = level.get(options.type === "unbroken");

        let entry: LeaderboardEntry | undefined = undefined;
        for (const score of board.top1000) {
            if (!owner && matchesUserFilter(user, score.owner)) {
                owner = score.owner;
            }
            if (score.owner.id === owner?.id) {
                entry = score;

                // Threshold processing
                for (const threshold of scoreCountThresholds) {
                    if (score.rank <= threshold) {
                        if (isCampgainLevel(level)) {
                            scoreCounts[threshold].overall += 1;
                            if (level.info.code.isChallenge) scoreCounts[threshold].challenge += 1;
                            else scoreCounts[threshold].regular += 1;
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
        all: findUser(
            (await globalLeaderboard({
                levelCategory: "all",
                type: options.type,
                scoreComputer: "rank",
            })) ?? [],
            owner.id
        ),
        regular: findUser(
            (await globalLeaderboard({
                levelCategory: "regular",
                type: options.type,
                scoreComputer: "rank",
            })) ?? [],
            owner.id
        ),
        challenge: findUser(
            (await globalLeaderboard({
                levelCategory: "challenge",
                type: options.type,
                scoreComputer: "rank",
            })) ?? [],
            owner.id
        ),
        weekly: findUser(
            (await globalLeaderboard({
                levelCategory: "weekly",
                type: options.type,
                scoreComputer: "rank",
            })) ?? [],
            owner.id
        ),
    };

    return {
        user: owner,
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
    options = Object.assign(defaultOptions, options);
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
        entry.score ? "$" + entry.score?.value?.toLocaleString("en-US") : "",
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
