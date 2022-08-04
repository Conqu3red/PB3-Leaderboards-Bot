import { CDN_URL, DATA_DIR } from "./Consts";
import { LevelLeaderboards, CampaignLevelInfo } from "./LeaderboardInterface";
import { BaseLevel, fetchRemoteLeaderboard } from "./Level";
import { Remote } from "./RemoteLeaderboardInterface";
import fs from "fs";
import path from "path";
import { processRemoteLeaderboard, updateOldestDataAndPurgeCheated } from "./LeaderboardProcessors";

function filenameFromCampaignLevelInfo(level: CampaignLevelInfo): string {
    return path.join(DATA_DIR, `${level.id}.json`);
}

export class CampaignLevel extends BaseLevel {
    info: CampaignLevelInfo;

    static generateLevelDownloadUrl(id: string) {
        return `${CDN_URL}/manifests/leaderboards/scores/${id}.json`
    }

    constructor(info: CampaignLevelInfo, reloadIntervalMs: number) {
        super(reloadIntervalMs);
        this.info = info;
    }

    async reload() {
        // TODO
        let leaderboards = await fetchRemoteLeaderboard(CampaignLevel.generateLevelDownloadUrl(this.info.id));
        this.reload_using(leaderboards);
    }

    async reload_using(leaderboards: Remote.LevelLeaderboards, carryOldest: boolean = true) {
        let current = await this.getLeaderboard();
        
        let processed: LevelLeaderboards = {
            any: processRemoteLeaderboard(leaderboards.any),
            unbroken: processRemoteLeaderboard(leaderboards.unbroken),
        }
        if (carryOldest) {
            updateOldestDataAndPurgeCheated(current.any, processed.any);
            updateOldestDataAndPurgeCheated(current.unbroken, processed.unbroken);
        }

        this.cachedLeaderboard = processed;
        //await this.saveCachedLeaderboard();
    }

    file(): string {
        return filenameFromCampaignLevelInfo(this.info);
    }
}