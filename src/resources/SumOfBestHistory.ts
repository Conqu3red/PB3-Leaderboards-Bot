import { DateTime } from "luxon";
import { GlobalEntry, ScoringMode, globalLeaderboard } from "../GlobalLeaderboard";
import { GameFilter, LeaderboardType, OldestEntry } from "../LeaderboardInterface";
import { database } from "./Lmdb";
import { OLDEST_RANK_LIMIT } from "../Consts";
import { sumOfBest } from "../SumOfBest";
import { WORLDS, World } from "../LevelCode";
import { formatWorldFilter, GAME_WORLDFILTERS, parseWorldFilter, VALID_WORLDFILTER_STRINGS, WorldFilter } from "../utils/WorldFilter";

export interface SumOfBestHistoryEntry {
    time: number; // epoch seconds
    score: number;
}

export class SumOfBestHistory {
    static RELOAD_FREQUENCY = 24 * 60 * 60 * 1000; // daily
    static lastReloadTimeMs = database.get("sobt") ?? 0;

    static timeUntilNextReload(): number {
        return this.RELOAD_FREQUENCY - (Date.now() - this.lastReloadTimeMs);
    }

    static get(type: LeaderboardType, world: WorldFilter | null, game: GameFilter): SumOfBestHistoryEntry[] {
        const board: SumOfBestHistoryEntry[] | undefined = database.get(this.lmdbKey(type, world, game));
        return board ?? [];
    }

    static async set(type: LeaderboardType, world: WorldFilter | null, game: GameFilter, data: SumOfBestHistoryEntry[]) {
        await database.put(this.lmdbKey(type, world, game), data);
    }

    static lmdbKey(type: LeaderboardType, world: WorldFilter | null, game: GameFilter): string {
        const gameString = (game == "pb3" || world) ? "" : ":" + game
        return `sob:${type}:${formatWorldFilter(world)}${gameString}`;
    }

    static lmdbTimeKey(type: LeaderboardType, world: World | null): string {
        return `sobt:${type}:${world ?? ""}`;
    }

    static async reloadAll() {
        const types: LeaderboardType[] = ["any", "unbreaking", "stress"];
        const gameFilters: GameFilter[] = ["all", "pb2", "pb3"];

        for (const type of types) {
            // All levels:
            for (const gameGroup of gameFilters) {
                if (gameGroup != "pb3" && type == "stress") continue;

                const sob = await sumOfBest(type, [], gameGroup);
                const history = this.updateHistory(this.get(type, null, gameGroup), sob.overall);
                await this.set(type, null, gameGroup, history);
                console.log(`[CacheManager] SoB History ${type} updated.`);
            }

            // Individual worlds:
            for (const world of VALID_WORLDFILTER_STRINGS) {
                const filter = parseWorldFilter(world);
                if (!filter) continue;
                const sob = await sumOfBest(type, [filter]);
                const history = this.updateHistory(this.get(type, filter, "all"), sob.overall);
                await this.set(type, filter, "all", history);
                console.log(`[CacheManager] SoB History ${type} (world ${world}) updated.`);
            }
        }

        this.lastReloadTimeMs = Date.now();
        await database.put("sobt", this.lastReloadTimeMs);
    }

    static updateHistory(history: SumOfBestHistoryEntry[], sob: number) {
        let time = 300 * Math.floor(DateTime.now().toSeconds() / 300);
        if (history.length === 0 || sob != history[history.length - 1].score)
            history.push({ score: sob, time });
        return history;
    }
}
