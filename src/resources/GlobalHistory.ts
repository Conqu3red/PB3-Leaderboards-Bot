import { DateTime } from "luxon";
import { GlobalEntry, ScoringMode, globalLeaderboard } from "../GlobalLeaderboard";
import { LeaderboardType, OldestEntry } from "../LeaderboardInterface";
import { database } from "./Lmdb";
import { OLDEST_RANK_LIMIT } from "../Consts";
import { cacheManager } from "./CacheManager";
import { WORLDS, World } from "../LevelCode";

export interface GlobalHistoryEntry extends GlobalEntry {
    time: number; // epoch seconds
}

export class GlobalHistory {
    static RELOAD_FREQUENCY = 1 * 60 * 60 * 1000; // hourly
    static lastReloadTimeMs = database.get("globalt") ?? 0;

    static timeUntilNextReload(): number {
        return this.RELOAD_FREQUENCY - (Date.now() - this.lastReloadTimeMs);
    }

    static get(
        type: LeaderboardType,
        world: World | null,
        mode: ScoringMode
    ): GlobalHistoryEntry[] {
        const board: GlobalHistoryEntry[] | undefined = database.get(
            this.lmdbKey(type, world, mode)
        );
        return board ?? [];
    }

    static async set(
        type: LeaderboardType,
        world: World | null,
        mode: ScoringMode,
        data: GlobalHistoryEntry[]
    ) {
        await database.put(this.lmdbKey(type, world, mode), data);
    }

    static lmdbKey(type: LeaderboardType, world: World | null, mode: ScoringMode): string {
        return `global:${type}:${mode}${world === null ? "" : ":" + world}`;
    }

    static async reloadAll() {
        const types: LeaderboardType[] = ["any", "unbreaking", "stress"];
        const modes: ScoringMode[] = ["rank", "score"];

        for (const type of types) {
            for (const mode of modes) {
                const top = await globalLeaderboard({
                    levelCategory: "all",
                    type: type,
                    scoringMode: mode,
                });
                if (top) {
                    const history = this.updateHistory(
                        this.get(type, null, mode),
                        top,
                        type,
                        null,
                        mode
                    );
                    await this.set(type, null, mode, history);
                    console.log(`[CacheManager] Global History History ${type} / ${mode} updated.`);
                }

                for (const world of WORLDS) {
                    const top = await globalLeaderboard({
                        levelCategory: "all",
                        type: type,
                        scoringMode: mode,
                        worldFilters: [world],
                    });
                    if (top) {
                        const history = this.updateHistory(
                            this.get(type, world, mode),
                            top,
                            type,
                            world,
                            mode
                        );
                        await this.set(type, world, mode, history);
                        console.log(
                            `[CacheManager] Global History History ${type} / ${mode} / ${world} updated.`
                        );
                    }
                }
            }
        }

        this.lastReloadTimeMs = Date.now();
        await database.put("globalt", this.lastReloadTimeMs);
    }

    static JUNE_1ST_RANK_FILTER = 1400;
    static JUNE_1ST_BUDGET_FILTER = 1_000_000;
    static JUNE_1ST_STRESS_FILTER = 500_000;
    static JUNE_1ST_CUTOFF = DateTime.fromISO("2023-06-05").toSeconds();

    static updateHistory(
        history: GlobalHistoryEntry[],
        newTop: GlobalEntry[],
        type: LeaderboardType,
        world: World | null,
        mode: ScoringMode
    ) {
        let has_june_1st_patch = database.get(`june_1st_patch:${type}:${mode}`);

        let time = 300 * Math.floor(DateTime.now().toSeconds() / 300);

        if (!has_june_1st_patch && !world) {
            console.log(
                `[CacheManager] Applying JUNE1ST Patch to global history ${type} / ${mode}`
            );
            if (mode === "rank") {
                history = history.filter(
                    (h) => h.time > this.JUNE_1ST_CUTOFF || h.value > this.JUNE_1ST_RANK_FILTER
                );
            } else {
                if (type === "stress") {
                    history = history.filter(
                        (h) =>
                            h.time > this.JUNE_1ST_CUTOFF || h.value > this.JUNE_1ST_STRESS_FILTER
                    );
                } else {
                    history = history.filter(
                        (h) =>
                            h.time > this.JUNE_1ST_CUTOFF || h.value > this.JUNE_1ST_BUDGET_FILTER
                    );
                }
            }
            database.putSync(`june_1st_patch:${type}:${mode}`, Date.now());
        }

        let latest_history_scores: Map<string, GlobalHistoryEntry> = new Map();
        for (const entry of history) {
            latest_history_scores.set(entry.steam_id_user, entry);
        }

        for (const entry of newTop) {
            if (entry.rank > 5) break;
            const users_last_score = latest_history_scores.get(entry.steam_id_user);
            if (!users_last_score || entry.value != users_last_score.value) {
                history.push({ ...entry, time });
            }
        }

        return history;
    }
}
