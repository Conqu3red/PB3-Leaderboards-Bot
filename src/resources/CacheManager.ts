import { CdnResource } from "./CdnResource";
import { weeklyIndex } from "./WeeklyIndex";
import { WeeklyLevel } from "./WeeklyLevel";
import { loadCampaignLevelInfos } from "./CampaignIndex";
import { CampaignLevel } from "./CampaignLevel";
import { LevelCode, levelCodeEqual, parseLevelCode } from "../LevelCode";

export async function bulkMaybeReload(resources: CdnResource<any, any>[]) {
    return Promise.all(
        resources.map(async (resource) => {
            if (await resource.needsReload()) await resource.reload();
        })
    );
}

export class CampaignManager {
    static CAMPAIGN_LEVEL_RELOAD_INTERVAL = 8 * 60 * 60 * 1000; // 8 hours
    campaignLevels: CampaignLevel[] = [];

    async populate() {
        let levelInfos = await loadCampaignLevelInfos();
        this.campaignLevels = levelInfos.map(
            (info) => new CampaignLevel(info, CampaignManager.CAMPAIGN_LEVEL_RELOAD_INTERVAL)
        );
    }

    async maybeReload() {
        let reloadRequired =
            this.campaignLevels.length === 0 ||
            this.campaignLevels.some((level) => level.needsReload());
        if (reloadRequired) await this.populate();

        await bulkMaybeReload(this.campaignLevels);
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
}

export class WeeklyManager {
    static WEEKLY_RELOAD_INTERVAL = 60 * 60 * 1000; // 1 hour
    weeklyLevels: WeeklyLevel[] = [];

    async populate() {
        if (await weeklyIndex.needsReload()) {
            await weeklyIndex.reload();
        }
        let levelInfos = await weeklyIndex.get();
        this.weeklyLevels = levelInfos.map(
            (info) => new WeeklyLevel(info, WeeklyManager.WEEKLY_RELOAD_INTERVAL)
        );
    }

    async maybeReload() {
        let reloadRequired =
            this.weeklyLevels.length == 0 || this.weeklyLevels.some((level) => level.needsReload());
        if (reloadRequired) await this.populate();
        await bulkMaybeReload(this.weeklyLevels);
    }

    async getLatest(): Promise<WeeklyLevel | null> {
        await this.maybeReload();
        let week = Math.max(...this.weeklyLevels.map((level) => level.info.week));
        return this.getByWeek(week);
    }

    async getByWeek(week: number): Promise<WeeklyLevel | null> {
        await this.maybeReload();
        let level = this.weeklyLevels.find((level) => level.info.week === week);
        return level ?? null;
    }
}
