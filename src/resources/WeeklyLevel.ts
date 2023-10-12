import { WEEKLIES_PER_SEASON } from "../Consts";
import { LeaderboardType, WeeklyLevelInfo } from "../LeaderboardInterface";
import { CampaignManager } from "./CacheManager";
import { BaseLevel } from "./Level";
import { database } from "./Lmdb";

export class WeeklyLevel extends BaseLevel {
    info: WeeklyLevelInfo;
    week: number;

    constructor(info: WeeklyLevelInfo) {
        super();
        this.info = info;
        this.week = info.week;
        this.lastReloadTimeMs = database.get(`lbt:${this.lmdbKey()}`) ?? 0;
    }

    lmdbKey(): string {
        return `WC-${this.info.id}`;
    }

    remotePath(): string {
        return `manifests/leaderboards/scores/${this.info.id}.json`;
    }

    compactName(): string {
        return `Season ${Math.floor(this.info.week / WEEKLIES_PER_SEASON) + 1} Week ${
            this.info.week % WEEKLIES_PER_SEASON
        }`;
    }

    fullName(): string {
        return this.info.title;
    }

    timeUntilNextReload(): number {
        if (this.info.latest)
            return (
                CampaignManager.WEEKLY_LEVEL_RELOAD_INTERVAL - (Date.now() - this.lastReloadTimeMs)
            );
        return (
            CampaignManager.OLD_WEEKLY_LEVEL_RELOAD_INTERVAL - (Date.now() - this.lastReloadTimeMs)
        );
    }

    needsReload(): boolean {
        return this.timeUntilNextReload() <= 0;
    }

    getLeaderboardName(leaderboardType: LeaderboardType) {
        let postfix = "";
        if (leaderboardType !== "any") postfix = "_" + leaderboardType;
        return `${this.info.id}${postfix}`;
    }
}
