import { RemoteResource } from "./RemoteResource";
import { weeklyIndex } from "./WeeklyIndex";
import { WeeklyLevel } from "./WeeklyLevel";
import { loadCampaignLevelInfos } from "./CampaignIndex";
import { CampaignLevel } from "./CampaignLevel";
import { LevelCode, levelCodeEqual, parseLevelCode } from "../LevelCode";
import { campaignBuckets } from "./Buckets";
import { asyncSetTimeout } from "../utils/asyncTimeout";
import { Leaderboard, LeaderboardType } from "../LeaderboardInterface";
import database, { userDB } from "./Lmdb";
import RateLimit from "../utils/RateLimit";
import SteamUser from "steam-user";
import { ClientLBSGetLBEntriesResponse } from "../Steam";
import { updateHistoryData } from "../LeaderboardProcessors";
import SteamUsernames, { PriorityLevel } from "./SteamUsernameHandler";
import { steamUser } from "./SteamUser";

export class CampaignManager {
    static CAMPAIGN_LEVEL_RELOAD_INTERVAL = 8 * 60 * 60 * 1000; // 8 hours
    static RATELIMIT_MS = 1000;
    static ID_RELOAD_INTERVAL = 80 * 60 * 60 * 1000; // 80 hours
    campaignLevels: CampaignLevel[] = [];

    async populate() {
        let levelInfos = await loadCampaignLevelInfos();
        this.campaignLevels = levelInfos.map((info) => new CampaignLevel(info));
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
    }

    async timeToNextReload(): Promise<number> {
        return Math.min(
            ...(await Promise.all(this.campaignLevels.map((level) => level.timeUntilNextReload())))
        );
    }

    async getByCode(code: LevelCode | string): Promise<CampaignLevel | null> {
        await this.maybeReload();
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

    async getLeaderboardId(
        level: CampaignLevel,
        leaderboardType: LeaderboardType
    ): Promise<number> {
        const boardName = level.getLeaderboardName(leaderboardType);
        let id: number | undefined = database.get("id:" + boardName);
        if (!id) {
            console.error(
                `[CacheManager] CRITICAL leaderboard id missing: ${level.compactName()} ${boardName} ${leaderboardType}`
            );
            const board = await steamUser.GetLeaderboard(boardName);
            id = board.leaderboard_id;
            await database.put("id:" + boardName, id);
        }
        return id;
    }

    async reloadId(level: CampaignLevel, leaderboardType: LeaderboardType) {
        const boardName = level.getLeaderboardName(leaderboardType);
        const board = await steamUser.GetLeaderboard(boardName);
        await database.put("id:" + boardName, board.leaderboard_id);
        console.log(`[CacheManager] reloaded board id ${boardName} ${board.leaderboard_id}`);
    }

    static convertSteamData(entries: ClientLBSGetLBEntriesResponse): Leaderboard {
        return {
            top1000: entries.entries.map((entry) => ({
                steam_id_user: entry.steam_id_user,
                score: entry.score,
                didBreak: entry.details != null && entry.details.readUint32LE(0) != 0,
                rank: entry.global_rank,
            })),
            leaderboard_entry_count: entries.leaderboard_entry_count,
        };
    }

    async reloadType(
        level: CampaignLevel,
        leaderboardType: LeaderboardType,
        reloadId: boolean,
        rateLimit: RateLimit
    ) {
        if (reloadId) {
            rateLimit.begin();
            await this.reloadId(level, leaderboardType);
            await rateLimit.waitRest();
        }
        const id = await this.getLeaderboardId(level, leaderboardType);

        const oldBoard = level.get(leaderboardType);

        rateLimit.begin();
        const board = await steamUser.GetLeaderboardEntries(
            id,
            0,
            1000,
            SteamUser.ELeaderboardDataRequest.Global
        );

        await rateLimit.waitRest();

        const newBoard = CampaignManager.convertSteamData(board);

        await database.transaction(async () => {
            await level.set(newBoard, leaderboardType);
            await level.setHistory(
                updateHistoryData(oldBoard, newBoard, level.getHistory(leaderboardType)),
                leaderboardType
            );
        });

        console.log(`[CacheManager] Reloaded ${level.compactName()}:${leaderboardType}`);

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

    async reload(level: CampaignLevel) {
        const rateLimit = new RateLimit(CampaignManager.RATELIMIT_MS);

        const last_id_reload: number = database.get("idt:" + level.lmdbKey()) ?? 0;
        let reload_ids = false;

        if (Date.now() - last_id_reload >= CampaignManager.ID_RELOAD_INTERVAL) {
            reload_ids = true;
        }

        level.lastReloadTimeMs = Date.now();

        await this.reloadType(level, "any", reload_ids, rateLimit);
        await this.reloadType(level, "unbroken", reload_ids, rateLimit);
        await this.reloadType(level, "stress", reload_ids, rateLimit);

        if (reload_ids) {
            await database.put("idt:" + level.lmdbKey(), Date.now());
        }
        /* const any = this.get(false);
        const anyNew = processRemoteLeaderboard(remote.any);
        const unbroken = this.get(true);
        const unbrokenNew = processRemoteLeaderboard(remote.unbroken);

        await database.transaction(async () => {
            await this.set(anyNew, false);
            await this.set(unbrokenNew, true);

            await this.setHistory(updateHistoryData(any, anyNew, this.getHistory(false)), false);
            await this.setHistory(
                updateHistoryData(unbroken, unbrokenNew, this.getHistory(true)),
                true
            );
        }); */
    }
}

export class CacheManager {
    campaignManager = new CampaignManager();
    steamRateLimit = new RateLimit(CampaignManager.RATELIMIT_MS);

    async maybeReload() {
        await this.campaignManager.maybeReload();
        if (campaignBuckets.needsReload()) await campaignBuckets.reload();
    }

    async nameUpdate() {
        while (true) {
            this.steamRateLimit.begin();
            const didUpdate = await SteamUsernames.reload();
            await this.steamRateLimit.waitRest();

            // check background update
            const last_refresh: number | undefined = userDB.get("_refresh");
            if (!last_refresh || Date.now() - last_refresh > SteamUsernames.ID_RELOAD_INTERVAL) {
                SteamUsernames.pushStale();
                await userDB.put("_refresh", Date.now());
            }
        }
    }

    async backgroundUpdate() {
        await this.campaignManager.populate();
        SteamUsernames.initQueues();

        while (true) {
            let nextReloadTime = Math.min(
                await this.campaignManager.timeToNextReload(),
                await campaignBuckets.timeUntilNextReload()
            );

            console.log(`[CacheManager] Next reload in ${nextReloadTime / 1000}s`);
            await asyncSetTimeout(nextReloadTime);

            await this.maybeReload();
        }
    }
}

export const cacheManager = new CacheManager();
