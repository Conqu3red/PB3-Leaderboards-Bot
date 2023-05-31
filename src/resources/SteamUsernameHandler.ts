import { LookupUsers, UserLookupResult } from "../Steam";
import { steamAPI, steamUser } from "./SteamUser";
import Queue from "../utils/Queue";
import { userDB } from "./Lmdb";
import { cacheManager } from "./CacheManager";
import { LeaderboardType } from "../LeaderboardInterface";

export enum PriorityLevel {
    RETRY = -1000,
    TOP25 = 0,
    TOP100 = 1,
    TOP250 = 2,
    TOP1000 = 3,
    REFRESH = 4,
}

export enum UpdateResult {
    SUCCESS,
    EMPTY,
    FAILED,
}

export class UsernamePriorityBucket {
    idsQueued: Set<string> = new Set();
    idQueue: Queue<string> = new Queue();
    public priorityLevel: PriorityLevel;

    constructor(priorityLevel: PriorityLevel) {
        this.priorityLevel = priorityLevel;
    }

    containsId(steam_id: string): boolean {
        return this.idsQueued.has(steam_id);
    }

    enqueueId(steam_id: string) {
        if (!this.containsId(steam_id)) {
            this.idsQueued.add(steam_id);
            this.idQueue.push(steam_id);
        }
    }

    dequeueId(steam_id: string) {
        this.idsQueued.delete(steam_id);
    }

    pullUsernames(buffer: string[]) {
        while (buffer.length < 100) {
            if (this.idQueue.isEmpty()) break;
            const v = this.idQueue.shift();
            if (v != null && this.idsQueued.has(v)) {
                buffer.push(v);
                this.idsQueued.delete(v);
            } // TODO: don't reload recent
        }
    }
}

export default class SteamUsernames {
    static buckets = [
        new UsernamePriorityBucket(PriorityLevel.RETRY),
        new UsernamePriorityBucket(PriorityLevel.TOP25),
        new UsernamePriorityBucket(PriorityLevel.TOP100),
        new UsernamePriorityBucket(PriorityLevel.TOP250),
        new UsernamePriorityBucket(PriorityLevel.TOP1000),
        new UsernamePriorityBucket(PriorityLevel.REFRESH),
    ];

    static enqueueId(steam_id: string, priorityLevel: PriorityLevel) {
        const lastReload: number = this.getReload(steam_id);
        if (lastReload < this.ID_RELOAD_INTERVAL) return;

        for (var level of this.buckets) {
            if (level.priorityLevel < priorityLevel && level.containsId(steam_id)) {
                break; // already in higher priority
            } else if (level.priorityLevel == priorityLevel) {
                level.enqueueId(steam_id);
            } else if (level.priorityLevel > priorityLevel && level.containsId(steam_id)) {
                level.dequeueId(steam_id); // priority has moved down
            }
        }
    }

    static pushStale() {
        const now = Date.now();
        let toUpdate = [];
        for (const { key, value } of userDB.getRange({ start: "t", end: "tz" })) {
            if (now - value > this.ID_RELOAD_INTERVAL) {
                toUpdate.push({
                    key: (key as string).slice(1),
                    t: now - value,
                });
            }
        }

        toUpdate.sort((a, b) => b.t - a.t);

        let count = 0;

        for (const { key } of toUpdate) {
            count++;
            this.enqueueId(key, PriorityLevel.REFRESH);
        }

        console.log(`[SteamUsernames] Added ${count} stale usernames to refersh queue.`);
    }

    static initQueues() {
        for (const level of cacheManager.campaignManager.campaignLevels) {
            for (const type of ["any", "unbreaking", "stress"]) {
                const board = level.get(type as LeaderboardType);
                for (const score of board.top1000) {
                    const lastReload = this.getReload(score.steam_id_user);
                    if (lastReload === Infinity) {
                        // queue only missing usernames
                        if (score.rank <= 25)
                            SteamUsernames.enqueueId(score.steam_id_user, PriorityLevel.TOP25);
                        else if (score.rank <= 100)
                            SteamUsernames.enqueueId(score.steam_id_user, PriorityLevel.TOP100);
                        else if (score.rank <= 250)
                            SteamUsernames.enqueueId(score.steam_id_user, PriorityLevel.TOP250);
                        else SteamUsernames.enqueueId(score.steam_id_user, PriorityLevel.TOP1000);
                    }
                }
            }
        }
        console.log("[SteamUsernames] Finished initialising missing IDs");
        for (const level of this.buckets) {
            console.log(
                `[SteamUsernames] ${PriorityLevel[level.priorityLevel]} = ${level.idQueue.length()}`
            );
        }
    }

    static async reload(): Promise<UpdateResult> {
        let ids: string[] = [];
        for (const level of this.buckets) {
            if (level.idsQueued.size > 0) {
                console.log(
                    `[SteamUsernames] ${
                        PriorityLevel[level.priorityLevel]
                    } = ${level.idQueue.length()}`
                );
            }
            level.pullUsernames(ids);
        }

        return await this.reloadBatch(ids);
    }

    static async reloadBatch(ids: string[]): Promise<UpdateResult> {
        if (ids.length == 0) return UpdateResult.EMPTY;

        let response: UserLookupResult;
        try {
            response = await LookupUsers(steamAPI, ids, steamUser.cellID);
        } catch (e) {
            console.error(`[SteamUsernames] ERR when trying to reload users ${e}`);
            // push to priority retry queue
            for (const id of ids) {
                this.enqueueId(id, PriorityLevel.RETRY);
            }
            return UpdateResult.FAILED;
        }

        const updateTime = Date.now();

        await userDB.transaction(async () => {
            for (const player of response.players) {
                await userDB.put(player.steamid, player.personaname);
                await userDB.put("t" + player.steamid, updateTime);
            }
        });

        console.log(`[SteamUsernames] loaded ${ids.length} IDs.`);

        return UpdateResult.SUCCESS;
    }

    static get(steam_id: string): string {
        let username: string | undefined = userDB.get(steam_id);
        return username ?? `<${steam_id}>`;
    }

    static getReload(steam_id: string): number {
        let reload: number | undefined = userDB.get("t" + steam_id);
        if (reload === undefined) {
            return Infinity; // needs reload
        }
        return Date.now() - reload;
    }

    static ID_RELOAD_INTERVAL = 100 * 60 * 60 * 1000; // 100 hours
    // TODO: priority updates for the very highest users
}
