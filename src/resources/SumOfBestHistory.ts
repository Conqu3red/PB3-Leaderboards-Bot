import { DateTime } from "luxon";
import { GlobalEntry, ScoringMode, globalLeaderboard } from "../GlobalLeaderboard";
import { LeaderboardType, OldestEntry } from "../LeaderboardInterface";
import { database } from "./Lmdb";
import { OLDEST_RANK_LIMIT } from "../Consts";
import { sumOfBest } from "../SumOfBest";
import { WORLDS } from "../LevelCode";
import { parseWorldFilter } from "../utils/WorldFilter";

export interface SumOfBestHistoryEntry {
    time: number; // epoch seconds
    score: number;
}

export class SumOfBestHistory {
    static RELOAD_FREQUENCY = 30 * 60 * 1000; // 30 minutes
    static lastReloadTimeMs = database.get("sobt") ?? 0;

    static timeUntilNextReload(): number {
        return this.RELOAD_FREQUENCY - (Date.now() - this.lastReloadTimeMs);
    }

    static get(type: LeaderboardType, world: string | null): SumOfBestHistoryEntry[] {
        const board: SumOfBestHistoryEntry[] | undefined = database.get(this.lmdbKey(type, world));
        return board ?? [];
    }

    static async set(type: LeaderboardType, world: string | null, data: SumOfBestHistoryEntry[]) {
        await database.put(this.lmdbKey(type, world), data);
    }

    static lmdbKey(type: LeaderboardType, world: string | null): string {
        return `sob:${type}:${world ?? ""}`;
    }

    static lmdbTimeKey(type: LeaderboardType, world: string | null): string {
        return `sobt:${type}:${world ?? ""}`;
    }

    static async reloadAll() {
        for (const type of ["any", "unbreaking", "stress"]) {
            const sob = await sumOfBest(type as LeaderboardType);
            const history = this.updateHistory(
                this.get(type as LeaderboardType, null),
                sob.overall
            );
            await this.set(type as LeaderboardType, null, history);
            console.log(`[CacheManager] SoB History ${type} updated.`);

            // Individual world
            for (const world of WORLDS) {
                const filter = parseWorldFilter(world);
                if (!filter) continue;
                const sob = await sumOfBest(type as LeaderboardType, [filter]);
                const history = this.updateHistory(
                    this.get(type as LeaderboardType, world),
                    sob.overall
                );
                await this.set(type as LeaderboardType, world, history);
                console.log(`[CacheManager] SoB History ${type} (world ${world}) updated.`);
            }
        }

        this.lastReloadTimeMs = Date.now();
        await database.put("sobt", this.lastReloadTimeMs);
    }

    static updateHistory(history: SumOfBestHistoryEntry[], sob: number) {
        let time = 300 * Math.floor(DateTime.now().toSeconds() / 300);
        history.push({ score: sob, time });
        return history;
    }
}
