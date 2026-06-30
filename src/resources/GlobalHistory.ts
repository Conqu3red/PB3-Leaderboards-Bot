import { DateTime } from "luxon";
import { GlobalEntry, ScoringMode, globalLeaderboard } from "../GlobalLeaderboard";
import { GameFilter, LeaderboardType, OldestEntry } from "../LeaderboardInterface";
import { database } from "./Lmdb";
import { OLDEST_RANK_LIMIT } from "../Consts";
import { cacheManager } from "./CacheManager";
import { WORLDS, World } from "../LevelCode";
import { formatWorldFilter, GAME_WORLDFILTERS, parseWorldFilter, VALID_WORLDFILTER_STRINGS, WorldFilter } from "../utils/WorldFilter";

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
        world: WorldFilter | null,
        mode: ScoringMode,
        game: GameFilter
    ): GlobalHistoryEntry[] {
        const board: GlobalHistoryEntry[] | undefined = database.get(
            this.lmdbKey(type, world, mode, game)
        );
        return board ?? [];
    }

    static async set(
        type: LeaderboardType,
        world: WorldFilter | null,
        mode: ScoringMode,
        game: GameFilter,
        data: GlobalHistoryEntry[]
    ) {
        await database.put(this.lmdbKey(type, world, mode, game), data);
    }

    static lmdbKey(type: LeaderboardType, world: WorldFilter | null, mode: ScoringMode, game: GameFilter): string {
        const gameString = (game == "pb3" || world) ? "" : ":" + game
        return `global:${type}:${mode}${world === null ? "" : ":" + formatWorldFilter(world)}${gameString}`;
    }

    static async reloadAll() {
        const types: LeaderboardType[] = ["any", "unbreaking", "stress"];
        const modes: ScoringMode[] = ["rank", "score"];
        const gameFilters: GameFilter[] = ["all", "pb2", "pb3"];

        for (const type of types) {
            for (const mode of modes) {
                for (const gameGroup of gameFilters) {
                    if (gameGroup != "pb3" && type == "stress") continue;
                
                    const top = await globalLeaderboard({
                        levelCategory: "all",
                        type: type,
                        scoringMode: mode,
                        game: gameGroup
                    });
                    if (top) {
                        const history = this.updateHistory(
                            this.get(type, null, mode, gameGroup),
                            top,
                            type,
                            null,
                            mode
                        );
                        await this.set(type, null, mode, gameGroup, history);
                        console.log(`[CacheManager] Global History History ${type} / ${mode} / ${gameGroup} updated.`);
                    }

                }

                // Individual worlds:
                for (const world of VALID_WORLDFILTER_STRINGS) {
                    const worldFilter = parseWorldFilter(world);
                    if (!worldFilter) {
                        console.error(`[CacheManager] Error! Unable to parse world filter ${world} during global history update.`);
                        continue;
                    }
                    const top = await globalLeaderboard({
                        levelCategory: "all",
                        type: type,
                        scoringMode: mode,
                        worldFilters: [worldFilter],
                        game: "all"
                    });
                    if (top) {
                        const history = this.updateHistory(
                            this.get(type, worldFilter, mode, "all"),
                            top,
                            type,
                            worldFilter,
                            mode
                        );
                        await this.set(type, worldFilter, mode, "all", history);
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
        world: WorldFilter | null,
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
            if (entry.rank > 10) break;
            const users_last_score = latest_history_scores.get(entry.steam_id_user);
            if (!users_last_score || entry.value != users_last_score.value) {
                history.push({ ...entry, time });
            }
        }

        return history;
    }
}
