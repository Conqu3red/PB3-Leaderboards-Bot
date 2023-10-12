import { BaseLevel } from "./Level";
import { CampaignLevelInfo } from "./CampaignIndex";
import { encodeLevelCode } from "../LevelCode";
import { database } from "./Lmdb";
import { updateHistoryData } from "../LeaderboardProcessors";
import { CampaignManager, cacheManager } from "./CacheManager";
import { steamUser } from "./SteamUser";
import SteamUser from "steam-user";
import RateLimit from "../utils/RateLimit";
import { LeaderboardType } from "../LeaderboardInterface";

export class CampaignLevel extends BaseLevel {
    info: CampaignLevelInfo;

    constructor(info: CampaignLevelInfo) {
        super();
        this.info = info;
        this.lastReloadTimeMs = database.get(`lbt:${this.lmdbKey()}`) ?? 0;
    }

    lmdbKey(): string {
        return this.info.id;
    }

    remotePath(): string {
        return `manifests/leaderboards/scores/${this.info.id}.json`;
    }

    compactName(): string {
        return encodeLevelCode(this.info.code);
    }

    fullName(): string {
        return this.info.name;
    }

    timeUntilNextReload(): number {
        return (
            CampaignManager.CAMPAIGN_LEVEL_RELOAD_INTERVAL - (Date.now() - this.lastReloadTimeMs)
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

export function isCampgainLevel(level: BaseLevel): level is CampaignLevel {
    return (level as CampaignLevel).info.code !== undefined;
}
