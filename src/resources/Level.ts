import { Leaderboard, LeaderboardType, OldestEntry } from "../LeaderboardInterface";

import fs from "fs";
import { RemoteResource } from "./RemoteResource";
import { parseLevelCode } from "../LevelCode";
import { encodeLevelCode } from "../LevelCode";
import { database } from "./Lmdb";

export abstract class BaseLevel {
    lastReloadTimeMs: number = 0;

    constructor() {}

    get(leaderboardType: LeaderboardType): Leaderboard {
        const board: Leaderboard | undefined = database.get(this.lmdbKeyBoard(leaderboardType));
        return board ?? { top1000: [], leaderboard_entry_count: 0 };
    }

    async set(board: Leaderboard, leaderboardType: LeaderboardType) {
        await database.put(`lbt:${this.lmdbKey()}`, this.lastReloadTimeMs);
        await database.put(this.lmdbKeyBoard(leaderboardType), board);
    }

    getHistory(leaderboardType: LeaderboardType): OldestEntry[] {
        const entries: OldestEntry[] | undefined = database.get(
            `${this.lmdbKeyBoard(leaderboardType)}:history`
        );
        return entries ?? [];
    }

    async setHistory(history: OldestEntry[], leaderboardType: LeaderboardType) {
        await database.put(`${this.lmdbKeyBoard(leaderboardType)}:history`, history);
    }

    abstract compactName(): string;
    abstract fullName(): string;
    abstract lmdbKey(): string;
    abstract timeUntilNextReload(): number;
    abstract getLeaderboardName(leaderboardType: LeaderboardType): string;

    lmdbKeyBoard(leaderboardType: LeaderboardType) {
        return `${this.lmdbKey()}:${leaderboardType}`;
    }
}
