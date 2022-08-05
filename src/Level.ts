import path from "path";
import axios from "axios";
import { DateTime } from "luxon";
import { Remote } from "./RemoteLeaderboardInterface";
import { ShortLevelIdentifier, LevelLeaderboards } from "./LeaderboardInterface";

import fs from "fs";

export function tryGetShortLevelIdentifier(short_name: string): ShortLevelIdentifier | null {
    let match = short_name.match(/(\d+)-(\d+)(c?)/i);
    if (match != null) {
        let ident: ShortLevelIdentifier = {
            world: parseInt(match[1]),
            level: parseInt(match[2]),
            isChallenge: match[3].length > 0,
        };

        if (ident.level !== NaN && ident.level !== NaN) return ident;
    }

    return null;
}

export async function fetchRemoteLeaderboard(url: string): Promise<Remote.LevelLeaderboards> {
    console.log(`Fetching Leaderboard at "${url}"`);
    let data = (await axios.get(url)).data;
    return data;
}

export abstract class BaseLevel {
    reloadIntervalMs: number;
    protected cachedLeaderboard: LevelLeaderboards | null = null;

    constructor(reloadIntervalMs: number) {
        this.reloadIntervalMs = reloadIntervalMs;
    }

    abstract reload(): Promise<void>;
    abstract file(): string;

    async last_reload(): Promise<number> {
        // TODO: catch error if file doesn't exist
        return (await fs.promises.stat(this.file())).mtimeMs;
    }

    async needs_reload(): Promise<boolean> {
        return Date.now() - (await this.last_reload()) > this.reloadIntervalMs;
    }

    async loadLeaderboardFromFile(): Promise<LevelLeaderboards> {
        // TODO: catch error if file doesn't exist
        const filePath = this.file();
        let data: LevelLeaderboards;
        try {
            data = JSON.parse(await fs.promises.readFile(filePath, "utf8"));
        } catch {
            data = {
                any: {
                    top1000: [],
                    top_history: undefined,
                    metadata: { uniqueRanksCount: 0 },
                },
                unbroken: {
                    top1000: [],
                    top_history: undefined,
                    metadata: { uniqueRanksCount: 0 },
                },
            };
        }
        this.cachedLeaderboard = data;
        return data;
    }

    async saveCachedLeaderboard() {
        if (this.cachedLeaderboard != null) {
            const filePath = this.file();

            await fs.promises.writeFile(filePath, JSON.stringify(this.cachedLeaderboard), "utf-8");
        }
    }

    async getLeaderboard(): Promise<LevelLeaderboards> {
        console.log(`cached leaderboard: ${this.cachedLeaderboard}`);
        if (this.cachedLeaderboard != null) {
            return this.cachedLeaderboard;
        }
        return this.loadLeaderboardFromFile();
    }
}
