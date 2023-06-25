import { DateTime } from "luxon";
import { GlobalEntry, ScoringMode, globalLeaderboard } from "../GlobalLeaderboard";
import { LeaderboardType, OldestEntry } from "../LeaderboardInterface";
import { database } from "./Lmdb";
import { OLDEST_RANK_LIMIT } from "../Consts";
import { sumOfBest } from "../SumOfBest";
import { WORLDS, World } from "../LevelCode";
import { parseWorldFilter } from "../utils/WorldFilter";

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

    static get(type: LeaderboardType, world: World | null): SumOfBestHistoryEntry[] {
        const board: SumOfBestHistoryEntry[] | undefined = database.get(this.lmdbKey(type, world));
        return board ?? [];
    }

    static async set(type: LeaderboardType, world: World | null, data: SumOfBestHistoryEntry[]) {
        await database.put(this.lmdbKey(type, world), data);
    }

    static lmdbKey(type: LeaderboardType, world: World | null): string {
        return `sob:${type}:${world ?? ""}`;
    }

    static lmdbTimeKey(type: LeaderboardType, world: World | null): string {
        return `sobt:${type}:${world ?? ""}`;
    }

    static async reloadAll() {
        const types: LeaderboardType[] = ["any", "unbreaking", "stress"];

        for (const type of types) {
            const sob = await sumOfBest(type);
            const history = this.updateHistory(this.get(type, null), sob.overall);
            await this.set(type, null, history);
            console.log(`[CacheManager] SoB History ${type} updated.`);

            // Individual world
            for (const world of WORLDS) {
                const filter = parseWorldFilter(world);
                if (!filter) continue;
                const sob = await sumOfBest(type, [filter]);
                const history = this.updateHistory(this.get(type, world), sob.overall);
                await this.set(type, world, history);
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
