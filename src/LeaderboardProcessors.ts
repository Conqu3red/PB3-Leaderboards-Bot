import { DateTime } from "luxon";
import { Remote } from "./RemoteLeaderboardInterface";
import { Leaderboard, LeaderboardEntry, OldestEntry } from "./LeaderboardInterface";

import { OLDEST_RANK_LIMIT, TIME_FORMAT } from "./Consts";

export function processRemoteLeaderboard(leaderboard: Remote.Leaderboard): Leaderboard {
    let result: Leaderboard = {
        top1000: [],
        metadata: leaderboard.metadata,
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

export function updateHistoryData(
    oldLeaderboard: Leaderboard,
    leaderboard: Leaderboard,
    history: OldestEntry[]
): OldestEntry[] {
    let oldHistory = history;

    let newHistory = [...oldHistory];

    let time = 3600 * Math.floor(DateTime.now().toSeconds() / 3600);

    // Identify removed scores
    let cheated_users: Set<string> = new Set();

    let new_scores: Map<string, number> = new Map(
        leaderboard.top1000.map((entry) => [entry.owner.id, entry.value])
    );

    for (const entry of oldLeaderboard.top1000) {
        if (entry.rank > OLDEST_RANK_LIMIT) break; // Only process 'cheated' entries relevant to oldest history
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

    // Mark cheated scores
    for (const entry of newHistory) {
        entry.cheated = entry.cheated || cheated_users.has(entry.owner.id);
    }

    let latest_history_scores: Map<string, OldestEntry> = new Map();
    for (const entry of oldHistory) {
        if (!latest_history_scores.has(entry.owner.id))
            latest_history_scores.set(entry.owner.id, entry);
    }

    // Push scores below `OLDEST_RANK_LIMIT` that aren't already in the history.
    for (let i = 0; i < leaderboard.top1000.length; i++) {
        let entry = leaderboard.top1000[i];
        if (entry.rank > OLDEST_RANK_LIMIT) break;

        const users_last_score = latest_history_scores.get(entry.owner.id);
        if (
            !users_last_score ||
            entry.value < users_last_score.value ||
            entry.didBreak !== users_last_score.didBreak
        ) {
            newHistory.push({ ...entry, time, cheated: false });
        }
    }

    return newHistory;
}
