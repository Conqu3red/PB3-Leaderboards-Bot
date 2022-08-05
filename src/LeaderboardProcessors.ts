import { DateTime } from "luxon";
import { Remote } from "./RemoteLeaderboardInterface";
import { Leaderboard, LeaderboardEntry } from "./LeaderboardInterface";

import { OLDEST_RANK_LIMIT, TIME_FORMAT } from "./Consts";

export function processRemoteLeaderboard(leaderboard: Remote.Leaderboard): Leaderboard {
    let result: Leaderboard = {
        top1000: [],
        metadata: leaderboard.metadata,
        top_history: undefined,
    };

    for (let i = 0; i < leaderboard.top1000.length; i++) {
        let new_entry: LeaderboardEntry = {
            ...leaderboard.top1000[i],
            rank: i + 1,
        };

        if (i > 0 && leaderboard.top1000[i - 1].value == leaderboard.top1000[i].value) {
            new_entry.rank = result.top1000[i - 1].rank; // propagate tied rank
        }

        result.top1000.push(new_entry);
    }

    return result;
}

export function updateOldestDataAndPurgeCheated(
    oldLeaderboard: Leaderboard,
    leaderboard: Leaderboard
): void {
    let oldHistory = oldLeaderboard.top_history ?? [];

    let oldScoreIds: Set<string> = new Set(oldHistory.map((el) => el.id));

    let newHistory = [...oldHistory];

    let time = DateTime.now().toFormat(TIME_FORMAT);

    // Push scores above `OLDEST_RANK_LIMIT` that aren't already in the history.
    for (let i = 0; i < leaderboard.top1000.length; i++) {
        let entry = leaderboard.top1000[i];
        if (entry.rank > OLDEST_RANK_LIMIT) break;

        if (!oldScoreIds.has(entry.id)) {
            newHistory.push({ ...entry, time });
        }
    }

    // Identify removed scores
    let cheated_users: Set<string> = new Set();

    let new_scores: Map<string, number> = new Map(
        leaderboard.top1000.map((entry) => [entry.owner.id, entry.value])
    );

    for (const entry of oldLeaderboard.top1000) {
        const old_score = entry.value;
        const new_score = new_scores.get(entry.owner.id);

        // User has been removed from leaderboard OR their score increased, indicating a score removal
        if (!new_score || new_score > old_score) {
            console.log(
                `Detected removed score of $${old_score} by ${entry.owner.display_name} (User ID: ${entry.owner.id})`
            );
            cheated_users.add(entry.owner.id);
        }
    }

    // Only users that haven't had a cheated score
    leaderboard.top_history = newHistory.filter((entry) => !cheated_users.has(entry.owner.id));
    console.log(leaderboard.top_history);
}
