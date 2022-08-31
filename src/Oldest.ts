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
import { UserFilter } from "./utils/userFilter";

export function groupBy<T, R>(arr: T[], prop: (obj: T) => R): Map<R, T[]> {
    const map: Map<R, T[]> = new Map(Array.from(arr, (obj) => [prop(obj), []]));
    arr.forEach((obj) => {
        let v = map.get(prop(obj));
        if (v) v.push(obj);
    });
    return map;
}

export interface UserStreakTracker {
    initialTime: number;
    latestScore: LeaderboardEntry;
    firstToGetThisScore: boolean;
}

export function getTopUserStreaks(board: Leaderboard): UserStreakTracker[] | null {
    if (!board.top_history) return null;

    //console.log(board.top_history.length);
    let topHistory: OldestEntry[] = board.top_history.sort((a, b) => a.time - b.time);

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
            topUsers.set(score.id, user);
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
                    `${timeToString(user.initialTime)} $${user.latestScore.value} (${
                        user.latestScore.owner.display_name
                    })`
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
    userFilter?: UserFilter; // TODO: support id and discord link
}

export interface PopulatedOldestEntry extends UserStreakTracker {
    compactName: string;
}

export async function getOldest(
    type: LeaderboardType,
    filters: OldestFilters
): Promise<PopulatedOldestEntry[]> {
    let levelEntries: PopulatedOldestEntry[] = [];

    await cacheManager.campaignManager.maybeReload();
    for (const level of cacheManager.campaignManager.campaignLevels) {
        if (filters.levelCode && !levelCodeEqual(level.info.code, filters.levelCode)) continue;
        const boards = await level.get();
        const board = selectLeaderboard(boards, type);
        const trackers = getTopUserStreaks(board) ?? [];
        const code = encodeLevelCode(level.info.code);

        levelEntries = levelEntries.concat(
            trackers
                .map((entry) => {
                    return { ...entry, compactName: code };
                })
                .filter(
                    (entry) =>
                        !filters.userFilter || filters.userFilter.matches(entry.latestScore.owner)
                )
        );

        // TODO: group entries that are from the same time?
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
        entry.latestScore.rank.toString(),
        entry.compactName,
        entry.latestScore.owner.display_name,
        DateTime.fromSeconds(entry.initialTime).toRelative({ base: now, style: "short" }) ?? "",
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
