import { Remote } from "../RemoteLeaderboardInterface";
import * as Local from "../LeaderboardInterface";
import { LevelLeaderboards } from "../LeaderboardInterface";

import fs from "fs";
import { RemoteResource } from "./RemoteResource";
import { parseLevelCode } from "../LevelCode";
import { encodeLevelCode } from "../LevelCode";
import database from "./Lmdb";

export abstract class BaseLevel<I> extends RemoteResource<Remote.LevelLeaderboards> {
    info: I;

    constructor(info: I, reloadIntervalMs: number) {
        super(reloadIntervalMs);
        this.info = info;

        this.lastReloadTimeMs = database.get(`${this.lmdbKey()}:last_reload`) ?? 0;
    }

    get(unbroken: boolean = false): Local.Leaderboard {
        const board: Local.Leaderboard | undefined = database.get(this.lmdbKeyBoard(unbroken));
        return board ?? { top1000: [], metadata: { uniqueRanksCount: 0 } };
    }

    async set(board: Local.Leaderboard, unbroken: boolean = false) {
        await database.put(`${this.lmdbKey()}:last_reload`, this.lastReloadTimeMs);
        await database.put(this.lmdbKeyBoard(unbroken), board);
    }

    getHistory(unbroken: boolean = false): Local.OldestEntry[] {
        const entries: Local.OldestEntry[] | undefined = database.get(
            `${this.lmdbKeyBoard(unbroken)}:history`
        );
        return entries ?? [];
    }

    async setHistory(history: Local.OldestEntry[], unbroken: boolean = false) {
        await database.put(`${this.lmdbKeyBoard(unbroken)}:history`, history);
    }

    abstract compactName(): string;
    abstract lmdbKey(): string;

    lmdbKeyBoard(unbroken: boolean) {
        return `${this.lmdbKey()}:${unbroken ? "unbroken" : "any"}`;
    }
}
