import { DateTime } from "luxon";
import { TIME_FORMAT } from "./Consts";
import { Leaderboard } from "./LeaderboardInterface";

export function groupBy<T, R>(arr: T[], prop: (obj: T) => R): Map<R, T[]> {
    const map: Map<R, T[]> = new Map(Array.from(arr, (obj) => [prop(obj), []]));
    arr.forEach((obj) => {
        let v = map.get(prop(obj));
        if (v) v.push(obj);
    });
    return map;
}

export function getTimeUserBecameTop(userID: string, board: Leaderboard): DateTime | null {
    let time = DateTime.max();
    if (!board.top_history) return null;

    let topHistory = board.top_history.sort((a, b) =>
        DateTime.fromFormat(b.time, TIME_FORMAT)
            .diff(DateTime.fromFormat(a.time, TIME_FORMAT))
            .toMillis()
    );

    // TODO: group by time

    for (const score of topHistory) {
        if (score.owner.id === userID) {
        }
    }

    return null;
}
