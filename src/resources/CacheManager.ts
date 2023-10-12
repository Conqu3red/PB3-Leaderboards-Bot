import { loadCampaignLevelInfos } from "./CampaignIndex";
import { CampaignLevel } from "./CampaignLevel";
import { LevelCode, levelCodeEqual, parseLevelCode } from "../LevelCode";
import { campaignBuckets } from "./Buckets";
import { asyncSetTimeout } from "../utils/asyncTimeout";
import { Leaderboard, LeaderboardType } from "../LeaderboardInterface";
import { database, userDB } from "./Lmdb";
import RateLimit from "../utils/RateLimit";
import SteamUser, { EResult } from "steam-user";
import { ClientLBSFindOrCreateLBResponse, ClientLBSGetLBEntriesResponse } from "./Steam";
import { updateHistoryData } from "../LeaderboardProcessors";
import SteamUsernames, { PriorityLevel, UpdateResult } from "./SteamUsernameHandler";
import { steamUser } from "./SteamUser";
import fs from "fs";
import { DATA_DIR } from "../Consts";
import { GlobalHistory } from "./GlobalHistory";
import { SumOfBestHistory } from "./SumOfBestHistory";
import { WeeklyLevel } from "./WeeklyLevel";
import { weeklyIndex } from "./WeeklyIndex";
import { BaseLevel } from "./Level";

export class CampaignManager {
    static CAMPAIGN_LEVEL_RELOAD_INTERVAL = 1 * 60 * 60 * 1000; // 1 hour
    static WEEKLY_LEVEL_RELOAD_INTERVAL = 1 * 15 * 60 * 1000; // 15 mins
    static OLD_WEEKLY_LEVEL_RELOAD_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours
    static RATELIMIT_MS = 1000;
    static ID_RELOAD_INTERVAL = 80 * 60 * 60 * 1000; // 80 hours
    campaignLevels: CampaignLevel[] = [];
    weeklyLevels: WeeklyLevel[] = [];

    async populate() {
        let levelInfos = await loadCampaignLevelInfos();
        this.campaignLevels = levelInfos.map((info) => new CampaignLevel(info));

        let weeklyInfos = await weeklyIndex.get();
        this.weeklyLevels = weeklyInfos.map((info) => new WeeklyLevel(info));
    }

    async maybeReload() {
        let reloadRequired = this.campaignLevels.some((level) => level.needsReload());

        if (this.campaignLevels.length === 0) {
            await this.populate();
            reloadRequired = true;
        }

        // Steam rate-limit of 1 per second

        for (const level of this.campaignLevels) {
            if (level.needsReload()) {
                await this.reload(level);
            }
        }

        for (const level of this.weeklyLevels) {
            if (level.needsReload()) {
                await this.reload(level);
            }
        }
    }

    async timeToNextReload(): Promise<number> {
        return Math.min(
            ...(await Promise.all(this.campaignLevels.map((level) => level.timeUntilNextReload()))),
            ...(await Promise.all(this.weeklyLevels.map((level) => level.timeUntilNextReload())))
        );
    }

    getByCode(code: LevelCode | string): CampaignLevel | null {
        let actualCode: LevelCode;
        if (typeof code === "string") {
            let newCode = parseLevelCode(code);
            if (newCode === null) return null;
            actualCode = newCode;
        } else {
            actualCode = code;
        }

        let level = this.campaignLevels.find((level) =>
            levelCodeEqual(level.info.code, actualCode)
        );
        return level ?? null;
    }

    getByWeek(week: number | null): WeeklyLevel | null {
        if (!week) {
            week = Math.max(...this.weeklyLevels.map((level) => level.info.week));
        }
        let level = this.weeklyLevels.find((level) => level.info.week == week);
        return level ?? null;
    }

    async getLeaderboardId(
        level: BaseLevel,
        leaderboardType: LeaderboardType
    ): Promise<number | null> {
        const boardName = level.getLeaderboardName(leaderboardType);
        let id: number | undefined = database.get("id:" + boardName);
        if (!id) {
            console.error(
                `[CacheManager] CRITICAL leaderboard id missing: ${level.compactName()} ${boardName} ${leaderboardType}`
            );
            if (!this.reloadId(level, leaderboardType)) return null;
            id = database.get("id:" + boardName);
            return id ?? null;
        }
        return id;
    }

    async reloadId(level: BaseLevel, leaderboardType: LeaderboardType): Promise<boolean> {
        const boardName = level.getLeaderboardName(leaderboardType);
        let board: ClientLBSFindOrCreateLBResponse;
        try {
            board = await steamUser.GetLeaderboard(boardName);
        } catch (e) {
            console.error(`[CacheManager] ERR unable to get leaderboard id.`);
            return false;
        }
        await database.put("id:" + boardName, board.leaderboard_id);
        console.log(`[CacheManager] Reloaded board id ${boardName} ${board.leaderboard_id}`);
        return true;
    }

    async invalidateId(level: BaseLevel, leaderboardType: LeaderboardType) {
        const boardName = level.getLeaderboardName(leaderboardType);
        await database.remove("id:" + boardName);
        await database.remove("idt:" + boardName);
    }

    static convertSteamData(entries: ClientLBSGetLBEntriesResponse): Leaderboard {
        return {
            top1000: entries.entries.map((entry) => ({
                steam_id_user: entry.steam_id_user,
                score: entry.score,
                didBreak: entry.details != null && (entry.details.readUint32LE(0) & 1) != 0, // After physics patch, all scores have flag 0x02
                rank: entry.global_rank,
            })),
            leaderboard_entry_count: entries.leaderboard_entry_count,
        };
    }

    async reloadType(
        level: BaseLevel,
        leaderboardType: LeaderboardType,
        reloadId: boolean,
        rateLimit: RateLimit
    ) {
        if (reloadId) {
            rateLimit.begin();
            const success = await this.reloadId(level, leaderboardType);
            if (!success) {
                console.error(
                    `[CacheManager] ERR, unable to reload board ${level.compactName()} (${leaderboardType})`
                );
                return;
            }
            await rateLimit.waitRest();
        }
        const id = await this.getLeaderboardId(level, leaderboardType);

        if (id === null) {
            console.error(
                `[CacheManager] ERR, unable to reload board - missing ID ${level.compactName()} (${leaderboardType})`
            );
            return;
        }

        const oldBoard = level.get(leaderboardType);

        rateLimit.begin();
        let board: ClientLBSGetLBEntriesResponse;
        try {
            board = await steamUser.GetLeaderboardEntries(
                id,
                0,
                1000,
                SteamUser.ELeaderboardDataRequest.Global
            );
        } catch (e: any) {
            console.error(
                `[CacheManager] ERR, unable to get leaderboard entries ${level.compactName()} (${leaderboardType})`
            );
            if (e.eresult !== undefined && e.eresult === EResult.AccessDenied) {
                this.invalidateId(level, leaderboardType);
                console.log(
                    `[CacheManager] Invalidated board ID for ${level.compactName()} (${leaderboardType})`
                );
            }
            return;
        }

        console.log(`[CacheManager] Reloaded ${level.compactName()}:${leaderboardType}`);

        await rateLimit.waitRest();

        const newBoard = CampaignManager.convertSteamData(board);
        const newHistory = await updateHistoryData(
            id,
            oldBoard,
            newBoard,
            level.getHistory(leaderboardType)
        );

        await database.transaction(async () => {
            await level.set(newBoard, leaderboardType);
            await level.setHistory(newHistory, leaderboardType);
        });

        for (const score of newBoard.top1000) {
            if (score.rank <= 25)
                SteamUsernames.enqueueId(score.steam_id_user, PriorityLevel.TOP25);
            else if (score.rank <= 100)
                SteamUsernames.enqueueId(score.steam_id_user, PriorityLevel.TOP100);
            else if (score.rank <= 250)
                SteamUsernames.enqueueId(score.steam_id_user, PriorityLevel.TOP250);
            else SteamUsernames.enqueueId(score.steam_id_user, PriorityLevel.TOP1000);
        }
    }

    async reload(level: BaseLevel) {
        const rateLimit = new RateLimit(CampaignManager.RATELIMIT_MS);

        const last_id_reload: number = database.get("idt:" + level.lmdbKey()) ?? 0;
        let reload_ids = false;

        if (Date.now() - last_id_reload >= CampaignManager.ID_RELOAD_INTERVAL) {
            reload_ids = true;
        }

        level.lastReloadTimeMs = Date.now();

        await this.reloadType(level, "any", reload_ids, rateLimit);
        await this.reloadType(level, "unbreaking", reload_ids, rateLimit);
        await this.reloadType(level, "stress", reload_ids, rateLimit);

        if (reload_ids) {
            await database.put("idt:" + level.lmdbKey(), Date.now());
        }
    }
}

export class CacheManager {
    campaignManager = new CampaignManager();
    steamRateLimit = new RateLimit(CampaignManager.RATELIMIT_MS);

    async maybeReload() {
        await this.campaignManager.maybeReload();
        if (campaignBuckets.needsReload()) await campaignBuckets.reload();
        if (weeklyIndex.needsReload()) {
            await weeklyIndex.reload();
            await this.campaignManager.populate();
        }

        if (GlobalHistory.timeUntilNextReload() < 0) await GlobalHistory.reloadAll();
        if (SumOfBestHistory.timeUntilNextReload() < 0) await SumOfBestHistory.reloadAll();
    }

    async nameUpdate() {
        while (true) {
            try {
                this.steamRateLimit.begin();
                const updateResult = await SteamUsernames.reload();
                if (updateResult === UpdateResult.FAILED) {
                    console.log(
                        "[SteamUsernames] request failed, pausing refresh for 30 seconds..."
                    );
                    await asyncSetTimeout(30_000);
                } else if (updateResult === UpdateResult.SUCCESS) {
                    await this.steamRateLimit.waitRest();
                } else {
                    await asyncSetTimeout(2500);
                }

                // check background update
                const last_refresh: number | undefined = userDB.get("_refresh");
                if (
                    !last_refresh ||
                    Date.now() - last_refresh > SteamUsernames.ID_RELOAD_INTERVAL
                ) {
                    SteamUsernames.pushStale();
                    await userDB.put("_refresh", Date.now());
                }
            } catch (e: any) {
                console.error(`[SteamUsernames] ERR: ${e && e.stack ? e.stack : e}`);
            }
        }
    }

    async backgroundUpdate() {
        await this.campaignManager.populate();
        SteamUsernames.initQueues();

        try {
            await fs.promises.access(DATA_DIR);
        } catch (error) {
            await fs.promises.mkdir(DATA_DIR, { recursive: true });
        }

        while (true) {
            try {
                let nextReloadTime = Math.min(
                    await this.campaignManager.timeToNextReload(),
                    campaignBuckets.timeUntilNextReload(),
                    weeklyIndex.timeUntilNextReload(),
                    GlobalHistory.timeUntilNextReload(),
                    SumOfBestHistory.timeUntilNextReload()
                );

                console.log(`[CacheManager] Next reload in ${nextReloadTime / 1000}s`);
                await asyncSetTimeout(nextReloadTime);

                await this.maybeReload();
            } catch (e: any) {
                console.error(`[CacheManager] ERR: ${e && e.stack ? e.stack : e}`);
            }
        }
    }
}

export const cacheManager = new CacheManager();
