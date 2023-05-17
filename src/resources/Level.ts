import { Leaderboard, LeaderboardType, OldestEntry } from "../LeaderboardInterface";

import fs from "fs";
import { RemoteResource } from "./RemoteResource";
import { parseLevelCode } from "../LevelCode";
import { encodeLevelCode } from "../LevelCode";
import database from "./Lmdb";
import leaderboard from "../bot/commands/lb/leaderboard";

export abstract class BaseLevel<I> {
    info: I;
    lastReloadTimeMs: number = 0;

    constructor(info: I) {
        this.info = info;

        this.lastReloadTimeMs = database.get(`${this.lmdbKey()}:last_reload`) ?? 0;
    }

    get(leaderboardType: LeaderboardType = "any"): Leaderboard {
        const board: Leaderboard | undefined = database.get(this.lmdbKeyBoard(leaderboardType));
        return board ?? { top1000: [], leaderboard_entry_count: 0 };
    }

    async set(board: Leaderboard, leaderboardType: LeaderboardType = "any") {
        await database.put(`${this.lmdbKey()}:last_reload`, this.lastReloadTimeMs);
        await database.put(this.lmdbKeyBoard(leaderboardType), board);
    }

    getHistory(leaderboardType: LeaderboardType = "any"): OldestEntry[] {
        const entries: OldestEntry[] | undefined = database.get(
            `${this.lmdbKeyBoard(leaderboardType)}:history`
        );
        return entries ?? [];
    }

    async setHistory(history: OldestEntry[], leaderboardType: LeaderboardType = "any") {
        await database.put(`${this.lmdbKeyBoard(leaderboardType)}:history`, history);
    }

    abstract compactName(): string;
    abstract lmdbKey(): string;

    lmdbKeyBoard(leaderboardType: LeaderboardType) {
        return `${this.lmdbKey()}:${leaderboardType}`;
    }
}
