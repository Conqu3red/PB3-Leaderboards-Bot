import { RemoteResource } from "./RemoteResource";
import { weeklyIndex } from "./WeeklyIndex";
import { WeeklyLevel } from "./WeeklyLevel";
import { loadCampaignLevelInfos } from "./CampaignIndex";
import { CampaignLevel } from "./CampaignLevel";
import { LevelCode, levelCodeEqual, parseLevelCode } from "../LevelCode";
import { campaignBuckets } from "./Buckets";
import { asyncSetTimeout } from "../utils/asyncTimeout";
import { steamUser } from "../bot/Index";
import { Leaderboard, LeaderboardType } from "../LeaderboardInterface";
import database from "./Lmdb";
import RateLimit from "../utils/RateLimit";
import SteamUser from "steam-user";
import { ClientLBSGetLBEntriesResponse } from "../Steam";
import { updateHistoryData } from "../LeaderboardProcessors";

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
                `[critical] leaderboard id missing: ${level.compactName()} ${
                    level.info.id
                } ${leaderboardType}`
            );
            const board = await steamUser.GetLeaderboard(boardName);
            // FIXME: leaderboard IDs need to be cached and rechecked occasionally?
            id = board.leaderboard_id;
            await database.put("id:" + boardName, id);
        }
        return id;
    }

    async reloadId(level: CampaignLevel, leaderboardType: LeaderboardType) {
        const boardName = level.getLeaderboardName(leaderboardType);
        const board = await steamUser.GetLeaderboard(boardName);
        await database.put("id:" + boardName, board.leaderboard_id);
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

        const oldBoard = level.get();

        const board = await steamUser.GetLeaderboardEntries(
            id,
            0,
            1000,
            SteamUser.ELeaderboardDataRequest.Global
        );

        const newBoard = CampaignManager.convertSteamData(board);

        console.log(`reload ${level.compactName()}:${leaderboardType}`);

        await database.transaction(async () => {
            // TODO: change interfaces to match steam, as ID cache
            await level.set(newBoard, leaderboardType);
            await level.setHistory(
                updateHistoryData(oldBoard, newBoard, level.getHistory(leaderboardType))
            );
        });
    }

    async reload(level: CampaignLevel) {
        const rateLimit = new RateLimit(CampaignManager.RATELIMIT_MS);

        const last_id_reload: number = database.get(level.lmdbKey() + ":idt") ?? 0;
        let reload_ids = false;

        if (Date.now() - last_id_reload >= CampaignManager.ID_RELOAD_INTERVAL) {
            await database.put(level.lmdbKey() + ":idt", Date.now());
            reload_ids = true;
        }

        this.reloadType(level, "any", reload_ids, rateLimit);
        this.reloadType(level, "unbroken", reload_ids, rateLimit);
        this.reloadType(level, "stress", reload_ids, rateLimit);
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
    // TODO: attach manager for bin collated file?

    async maybeReload() {
        await this.campaignManager.maybeReload();
        if (await campaignBuckets.needsReload()) await campaignBuckets.reload();
    }

    async backgroundUpdate() {
        await this.campaignManager.populate();

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
