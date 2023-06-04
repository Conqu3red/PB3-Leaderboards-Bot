import { DateTime } from "luxon";
import { Leaderboard, LeaderboardEntry, OldestEntry } from "./LeaderboardInterface";

import { OLDEST_RANK_LIMIT, TIME_FORMAT } from "./Consts";
import SteamUsernames from "./resources/SteamUsernameHandler";
import { LBEntry } from "./resources/Steam";
import { steamUser } from "./resources/SteamUser";
import SteamUser from "steam-user";
import RateLimit from "./utils/RateLimit";
import { CampaignManager } from "./resources/CacheManager";

function selectEachUserLatestScore(history: OldestEntry[]) {
    let scores: Map<string, OldestEntry> = new Map();

    for (let i = history.length - 1; i >= 0; i--) {
        const score = history[i];
        if (!score.cheated && !scores.has(score.steam_id_user)) {
            scores.set(score.steam_id_user, score);
        }
    }

    return scores;
}

export async function updateHistoryData(
    id: number,
    oldLeaderboard: Leaderboard,
    leaderboard: Leaderboard,
    history: OldestEntry[]
): Promise<OldestEntry[]> {
    let oldHistory = history;

    let newHistory = [...oldHistory];

    let time = 300 * Math.floor(DateTime.now().toSeconds() / 300);

    // Identify removed scores
    let cheated_users: Set<string> = new Set();
    let missing_entries: Map<string, LeaderboardEntry> = new Map();

    let new_scores: Map<string, number> = new Map(
        leaderboard.top1000.map((entry) => [entry.steam_id_user, entry.score])
    );

    // TODO: perfect checking involves going over *every* oldest score from this function
    // it is faster to just take the previous top 25, as this should resolve basically all sane circumstances.
    //const latestHistoryScores = selectEachUserLatestScore(history);
    // for (const [id, entry] of latestHistoryScores)

    let uniqueScores = 0;
    let prevScore = NaN;
    for (const entry of oldLeaderboard.top1000) {
        if (uniqueScores > OLDEST_RANK_LIMIT) break;
        if (entry.score !== prevScore) uniqueScores++;
        prevScore = entry.score;

        const old_score = entry.score;
        const new_score = new_scores.get(entry.steam_id_user);

        // User has been removed from leaderboard OR their score increased, indicating a score removal
        if (new_score && new_score > old_score) {
            console.log(
                `Detected removed score of $${old_score} by ${SteamUsernames.get(
                    entry.steam_id_user
                )} (User ID: ${entry.steam_id_user})`
            );
            cheated_users.add(entry.steam_id_user);
        } else if (!new_score) {
            // TODO: short circuit this path if the leaderboard has under 1000 entries on it
            if (leaderboard.leaderboard_entry_count > 999) {
                missing_entries.set(entry.steam_id_user, entry);
            } else {
                console.log(
                    `Detected removed score of $${old_score} by ${SteamUsernames.get(
                        entry.steam_id_user
                    )} (User ID: ${entry.steam_id_user})`
                );
                cheated_users.add(entry.steam_id_user);
            }
        }
    }

    try {
        if (missing_entries.size > 0) {
            console.log(`There are ${missing_entries.size} missing entries - checking with steam`);
            const ids = [...missing_entries.keys()];
            const newScores: Map<string, LBEntry> = new Map();
            for (let i = 0; i < ids.length; i += 100) {
                const ratelimit = new RateLimit(CampaignManager.RATELIMIT_MS);
                ratelimit.begin();
                const result = await steamUser.GetLeaderboardEntries(
                    id,
                    0,
                    1000,
                    SteamUser.ELeaderboardDataRequest.Users,
                    ids.slice(i, i + 100)
                );
                await ratelimit.waitRest();
                // FIXME: how the hell can error handling be done on this?
                for (const score of result.entries) {
                    newScores.set(score.steam_id_user, score);
                }
            }

            for (const [id, prevScore] of missing_entries) {
                const newScore = newScores.get(id);
                if (!newScore || newScore.score > prevScore.score) {
                    console.log(
                        `Detected removed score of $${prevScore.score} by ${SteamUsernames.get(
                            prevScore.steam_id_user
                        )} (User ID: ${prevScore.steam_id_user})`
                    );
                    cheated_users.add(prevScore.steam_id_user);
                }
            }
        }
    } catch (e: any) {
        console.error(
            `CRITICAL: failed to find missing entries to fix oldest history \n ${
                e && e.stack ? e.stack : e
            }`
        );
        console.error(`Assuming the scores are fine... this is really not good`);
    }

    // Mark cheated scores
    for (const entry of newHistory) {
        entry.cheated = entry.cheated || cheated_users.has(entry.steam_id_user);
    }

    let latest_history_scores: Map<string, OldestEntry> = new Map();
    for (const entry of oldHistory) {
        if (!entry.cheated) {
            latest_history_scores.set(entry.steam_id_user, entry);
        }
    }

    // Push scores below `OLDEST_RANK_LIMIT` that aren't already in the history.
    uniqueScores = 0;
    prevScore = NaN;
    for (let i = 0; i < leaderboard.top1000.length; i++) {
        let entry = leaderboard.top1000[i];
        if (uniqueScores > OLDEST_RANK_LIMIT) break;
        if (entry.score !== prevScore) uniqueScores++;
        prevScore = entry.score;

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
