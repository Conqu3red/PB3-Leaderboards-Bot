import { DateTime } from "luxon";
import { Leaderboard, LeaderboardEntry, OldestEntry } from "./LeaderboardInterface";

import { OLDEST_RANK_LIMIT, TIME_FORMAT } from "./Consts";
import SteamUsernames from "./resources/SteamUsernameHandler";

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
        leaderboard.top1000.map((entry) => [entry.steam_id_user, entry.score])
    );

    for (const entry of oldLeaderboard.top1000) {
        if (entry.rank > OLDEST_RANK_LIMIT) break; // Only process 'cheated' entries relevant to oldest history
        const old_score = entry.score;
        const new_score = new_scores.get(entry.steam_id_user);

        // User has been removed from leaderboard OR their score increased, indicating a score removal
        if (!new_score || new_score > old_score) {
            console.log(
                `Detected removed score of $${old_score} by ${SteamUsernames.get(
                    entry.steam_id_user
                )} (User ID: ${entry.steam_id_user})`
            );
            cheated_users.add(entry.steam_id_user);
        }
    }

    // Mark cheated scores
    for (const entry of newHistory) {
        entry.cheated = entry.cheated || cheated_users.has(entry.steam_id_user);
    }

    let latest_history_scores: Map<string, OldestEntry> = new Map();
    for (const entry of oldHistory) {
        latest_history_scores.set(entry.steam_id_user, entry);
    }

    // Push scores below `OLDEST_RANK_LIMIT` that aren't already in the history.
    for (let i = 0; i < leaderboard.top1000.length; i++) {
        let entry = leaderboard.top1000[i];
        if (entry.rank > OLDEST_RANK_LIMIT) break;

        const users_last_score = latest_history_scores.get(entry.steam_id_user);
        if (
            !users_last_score ||
            entry.score < users_last_score.score ||
            entry.didBreak !== users_last_score.didBreak
        ) {
            newHistory.push({ ...entry, time, cheated: false });
        }
    }

    return newHistory;
}
