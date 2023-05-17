import { BaseLevel } from "./Level";
import { CampaignLevelInfo } from "./CampaignIndex";
import { encodeLevelCode } from "../LevelCode";
import * as Local from "../LeaderboardInterface";
import database from "./Lmdb";
import { updateHistoryData } from "../LeaderboardProcessors";
import { CampaignManager, cacheManager } from "./CacheManager";
import { steamUser } from "../bot/Index";
import SteamUser from "steam-user";
import RateLimit from "../utils/RateLimit";

export class CampaignLevel extends BaseLevel<CampaignLevelInfo> {
    lmdbKey(): string {
        return this.info.id;
    }

    // TODO async reload();

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
        if (leaderboardType === "unbroken") postfix = "_unbreaking";
        if (leaderboardType === "stress") postfix = "_stress";
        return `${this.info.id}`;
    }
}
