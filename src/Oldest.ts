import { Canvas, createCanvas } from "canvas";
import { CanvasTable, CTColumn, CTConfig, CTData } from "canvas-table";
import { DateTime } from "luxon";
import { N_ENTRIES } from "./Consts";
import { selectLeaderboard } from "./GlobalLeaderboard";
import {
    Leaderboard,
    LeaderboardEntry,
    LeaderboardType,
    OldestEntry,
} from "./LeaderboardInterface";
import { encodeLevelCode, LevelCode, levelCodeEqual } from "./LevelCode";
import { cacheManager } from "./resources/CacheManager";
import { matchesUserFilter, UserFilter } from "./utils/userFilter";

export function groupBy<T, R>(arr: T[], prop: (obj: T) => R): Map<R, T[]> {
    const map: Map<R, T[]> = new Map();
    for (const obj of arr) {
        let v = map.get(prop(obj));
        if (v) {
            v.push(obj);
        } else {
            map.set(prop(obj), [obj]);
        }
    }
    return map;
}

export interface UserStreakTracker {
    initialTime: number;
    latestScore: LeaderboardEntry;
    firstToGetThisScore: boolean;
}

export function getTopUserStreaks(history: OldestEntry[]): UserStreakTracker[] | null {
    //console.log(board.top_history.length);
    // exclude cheated:
    history = history.filter((entry) => !entry.cheated);
    let topHistory: OldestEntry[] = history.sort((a, b) => a.time - b.time);

    let timeBrackets: Map<number, OldestEntry[]> = groupBy(topHistory, (obj) => obj.time);

    let topUsers: Map<string, UserStreakTracker> = new Map();
    let lowestScore = Infinity;

    for (const [time, scores] of timeBrackets) {
        let newTop = Math.min(...scores.map((score) => score.value));
        //console.log(newTop);

        // no improvements/ties
        if (newTop > lowestScore) continue;

        lowestScore = newTop;

        // add new improvements/ties
        for (const score of scores) {
            if (score.value > lowestScore) continue;

            let user = topUsers.get(score.owner.id);
            if (user) {
                // update with their newest score
                user.latestScore = score;
            } else {
                // new user got better/tied budget
                user = {
                    initialTime: score.time,
                    latestScore: score,
                    firstToGetThisScore: false,
                };
            }
            topUsers.set(score.owner.id, user);
        }

        // remove top users that no longer meet the top score
        for (const [id, user] of topUsers) {
            if (user.latestScore.value > lowestScore) {
                topUsers.delete(id);
            }
        }

        /* console.log(
            [...topUsers.values()].map(
                (user) =>
                    `${user.initialTime} $${user.latestScore.value} (${user.latestScore.owner.display_name})`
            )
        ); */
    }
    let lowestTime = Infinity;
    for (const [id, user] of topUsers) {
        if (user.initialTime < lowestTime) lowestTime = user.initialTime;
    }

    for (const [id, user] of topUsers) {
        if (user.initialTime === lowestTime) {
            user.firstToGetThisScore = true;
        }
    }

    return [...topUsers.values()];
}
/* 
export type LevelCategory = "all" | "regular" | "challenge" */

export interface OldestFilters {
    levelCode?: LevelCode;
    userFilter?: UserFilter;
}

export interface PopulatedOldestEntry extends UserStreakTracker {
    compactName: string;
    rank: number;
}

export async function getOldest(
    type: LeaderboardType,
    filters: OldestFilters
): Promise<PopulatedOldestEntry[]> {
    let levelEntries: PopulatedOldestEntry[] = [];

    for (const level of cacheManager.campaignManager.campaignLevels) {
        if (filters.levelCode && !levelCodeEqual(level.info.code, filters.levelCode)) continue;
        const history = level.getHistory(type === "unbroken");
        const trackers = getTopUserStreaks(history) ?? [];
        const code = encodeLevelCode(level.info.code);

        levelEntries = levelEntries.concat(
            trackers
                .map((entry) => {
                    return { ...entry, compactName: code, rank: 0 };
                })
                .filter(
                    (entry) =>
                        !filters.userFilter ||
                        matchesUserFilter(filters.userFilter, entry.latestScore.owner)
                )
        );

        // TODO: group entries that are from the same time?
    }

    levelEntries = levelEntries.sort((a, b) => a.initialTime - b.initialTime);

    for (let i = 0; i < levelEntries.length; i++) {
        levelEntries[i].rank = i + 1;

        if (i > 0 && levelEntries[i - 1].initialTime == levelEntries[i].initialTime) {
            levelEntries[i].rank = levelEntries[i - 1].rank; // propagate tied rank
        }
    }

    return levelEntries;
}

export const BOARD_DIMENSIONS: [width: number, height: number] = [400, 350];

export async function renderOldestCanvas(
    board: PopulatedOldestEntry[],
    index: number
): Promise<Canvas> {
    const canvas = createCanvas(...BOARD_DIMENSIONS);

    const columns: CTColumn[] = [
        { title: "#", options: { color: "#ffffff", textAlign: "right" } },
        { title: "Level", options: { color: "#ffffff" } },
        { title: "Name", options: { color: "#ffffff", maxWidth: 150 } },
        { title: "Time", options: { color: "#ffffff", textAlign: "right" } },
        { title: "Breaks", options: { color: "#ffffff" } },
        { title: "Tiebreaker", options: { color: "#ffffff" } },
    ];

    let page_index = Math.floor(index / N_ENTRIES);
    let chosen_entries = board.slice(page_index * N_ENTRIES, (page_index + 1) * N_ENTRIES);

    const now = DateTime.now();

    const data: CTData = chosen_entries.map((entry) => [
        entry.rank.toString(),
        entry.compactName,
        entry.latestScore.owner.display_name,
        DateTime.fromSeconds(entry.initialTime).toRelative({
            base: now,
            style: "short",
            unit: ["days", "hours", "minutes", "seconds"],
        }) ?? "",
        entry.latestScore.didBreak ? "✱" : "",
        entry.firstToGetThisScore ? "✱" : "",
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
    return canvas;
}

export async function renderOldest(board: PopulatedOldestEntry[], index: number): Promise<Buffer> {
    const canvas = await renderOldestCanvas(board, index);
    return canvas.toBuffer();
}
