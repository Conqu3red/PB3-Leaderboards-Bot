import { DateTime } from "luxon";
import { TIME_FORMAT } from "./Consts";
import { Leaderboard, LeaderboardEntry, OldestEntry } from "./LeaderboardInterface";
import { Remote } from "./RemoteLeaderboardInterface";

export function groupBy<T, R>(arr: T[], prop: (obj: T) => R): Map<R, T[]> {
    const map: Map<R, T[]> = new Map(Array.from(arr, (obj) => [prop(obj), []]));
    arr.forEach((obj) => {
        let v = map.get(prop(obj));
        if (v) v.push(obj);
    });
    return map;
}

function stringToTime(time: string): DateTime {
    return DateTime.fromFormat(time, TIME_FORMAT);
}

function timeToString(time: DateTime): string {
    return time.toFormat(TIME_FORMAT);
}

function lowestScoreInBrackets(brackets: OldestEntry[][], idToExclude: string): number {
    return Math.min(
        ...brackets.map((bracket) =>
            Math.min(
                ...bracket.map((score) => (score.owner.id == idToExclude ? Infinity : score.value))
            )
        )
    );
}

export interface UserScoreHistory {
    initialTime: DateTime;
    latestScore: LeaderboardEntry;
}

export function getTimeUserBecameTop(board: Leaderboard): UserScoreHistory[] | null {
    if (!board.top_history) return null;

    //console.log(board.top_history.length);
    let topHistory: OldestEntry[] = board.top_history.sort((a, b) => a.time - b.time);
    console.time("sortHistory");
    console.timeEnd("sortHistory");

    // TODO: group by time

    console.time("group");
    let timeBrackets: Map<number, OldestEntry[]> = groupBy(topHistory, (obj) => obj.time);
    console.timeEnd("group");

    // remove time brackets that occured after `score` was set
    /*
        | <value> | is a time bracket
        | ... | is 0 or more time brackets
        Recent          ------>          Past
        ... | moreRecentScore | ... | score | ...
                              |     <       |  <=  |
                              if any scores in these ranges match the condition 
                              compared to score, return moreRecentScore
        
        if it is the first score:
        | score | ...
        |   <   |  <=  |

        */

    let topUsers: Map<string, UserScoreHistory> = new Map();
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
                    initialTime: DateTime.fromSeconds(score.time),
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
