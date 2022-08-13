import { DateTime } from "luxon";
import { selectLeaderboard } from "./GlobalLeaderboard";
import {
    Leaderboard,
    LeaderboardEntry,
    LeaderboardType,
    OldestEntry,
} from "./LeaderboardInterface";
import { encodeLevelCode } from "./LevelCode";
import { cacheManager } from "./resources/CacheManager";

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

    return [...topUsers.values()];
}
/* 
export type LevelCategory = "all" | "regular" | "challenge" */

export interface LevelOldestEntry {
    compactName: string;
    entries: UserStreakTracker[];
}

export async function getOldest(type: LeaderboardType): Promise<LevelOldestEntry[]> {
    let levelEntries: LevelOldestEntry[] = [];

    await cacheManager.campaignManager.maybeReload();
    for (const level of cacheManager.campaignManager.campaignLevels) {
        const boards = await level.get();
        const board = selectLeaderboard(boards, type);

        const trackers = getTopUserStreaks(board) ?? [];

        levelEntries.push({ compactName: encodeLevelCode(level.info.code), entries: trackers });

        // TODO: group entries that are from the same time
    }

    return levelEntries;
}
