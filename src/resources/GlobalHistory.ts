import { DateTime } from "luxon";
import { GlobalEntry, ScoringMode, globalLeaderboard } from "../GlobalLeaderboard";
import { LeaderboardType, OldestEntry } from "../LeaderboardInterface";
import { database } from "./Lmdb";
import { OLDEST_RANK_LIMIT } from "../Consts";

export interface GlobalHistoryEntry extends GlobalEntry {
    time: number; // epoch seconds
}

export class GlobalHistory {
    static RELOAD_FREQUENCY = 30 * 60 * 1000; // 30 minutes
    static lastReloadTimeMs = database.get("globalt") ?? 0;

    static timeUntilNextReload(): number {
        return this.RELOAD_FREQUENCY - (Date.now() - this.lastReloadTimeMs);
    }

    static get(type: LeaderboardType, mode: ScoringMode): GlobalHistoryEntry[] {
        const board: GlobalHistoryEntry[] | undefined = database.get(this.lmdbKey(type, mode));
        return board ?? [];
    }

    static async set(type: LeaderboardType, mode: ScoringMode, data: GlobalHistoryEntry[]) {
        await database.put(this.lmdbKey(type, mode), data);
    }

    static lmdbKey(type: LeaderboardType, mode: ScoringMode): string {
        return `global:${type}:${mode}`;
    }

    static async reloadAll() {
        for (const type of ["any", "unbreaking", "stress"]) {
            for (const mode of ["rank", "score"]) {
                const top = await globalLeaderboard({
                    levelCategory: "all",
                    type: type as LeaderboardType,
                    scoringMode: mode as ScoringMode,
                });
                if (top) {
                    const history = this.updateHistory(
                        this.get(type as LeaderboardType, mode as ScoringMode),
                        top
                    );
                    await this.set(type as LeaderboardType, mode as ScoringMode, history);
                    console.log(`[CacheManager] Global History History ${type} / ${mode} updated.`);
                }
            }
        }

        this.lastReloadTimeMs = Date.now();
        await database.put("globalt", this.lastReloadTimeMs);
    }

    static updateHistory(history: GlobalHistoryEntry[], newTop: GlobalEntry[]) {
        let time = 300 * Math.floor(DateTime.now().toSeconds() / 300);

        let latest_history_scores: Map<string, GlobalHistoryEntry> = new Map();
        for (const entry of history) {
            latest_history_scores.set(entry.steam_id_user, entry);
        }

        for (const entry of newTop) {
            if (entry.rank > OLDEST_RANK_LIMIT) break;
            const users_last_score = latest_history_scores.get(entry.steam_id_user);
            if (!users_last_score || entry.value != users_last_score.value) {
                history.push({ ...entry, time });
            }
        }

        return history;
    }
}