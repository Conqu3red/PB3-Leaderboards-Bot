import { BaseLevel } from "./Level";
import { CampaignLevelInfo } from "./CampaignIndex";
import { encodeLevelCode } from "../LevelCode";
import * as Local from "../LeaderboardInterface";
import { database } from "./Lmdb";
import { updateHistoryData } from "../LeaderboardProcessors";
import { CampaignManager, cacheManager } from "./CacheManager";
import { steamUser } from "./SteamUser";
import SteamUser from "steam-user";
import RateLimit from "../utils/RateLimit";

export class CampaignLevel extends BaseLevel<CampaignLevelInfo> {
    lmdbKey(): string {
        return this.info.id;
    }

    remotePath(): string {
        return `manifests/leaderboards/scores/${this.info.id}.json`;
    }

    compactName(): string {
        return encodeLevelCode(this.info.code);
    }

    timeUntilNextReload(): number {
        return (
            CampaignManager.CAMPAIGN_LEVEL_RELOAD_INTERVAL - (Date.now() - this.lastReloadTimeMs)
        );
    }

    needsReload(): boolean {
        return this.timeUntilNextReload() <= 0;
    }

    getLeaderboardName(leaderboardType: Local.LeaderboardType) {
        let postfix = "";
        if (leaderboardType !== "any") postfix = "_" + leaderboardType;
        return `${this.info.id}${postfix}`;
    }
}
