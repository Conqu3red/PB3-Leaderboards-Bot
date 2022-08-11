import { LevelLeaderboards } from "../LeaderboardInterface";
import { BaseLevel } from "./Level";
import { Remote } from "../RemoteLeaderboardInterface";
import {
    processRemoteLeaderboard,
    updateOldestDataAndPurgeCheated,
} from "../LeaderboardProcessors";
import { CampaignLevelInfo } from "./CampaignIndex";

export class CampaignLevel extends BaseLevel {
    info: CampaignLevelInfo;

    constructor(info: CampaignLevelInfo, reloadIntervalMs: number) {
        super(reloadIntervalMs);
        this.info = info;
    }

    async processRemote(
        old: LevelLeaderboards,
        remote: Remote.LevelLeaderboards
    ): Promise<LevelLeaderboards> {
        let processed: LevelLeaderboards = {
            any: processRemoteLeaderboard(remote.any),
            unbroken: processRemoteLeaderboard(remote.unbroken),
        };

        updateOldestDataAndPurgeCheated(old.any, processed.any);
        updateOldestDataAndPurgeCheated(old.unbroken, processed.unbroken);

        return processed;
    }

    localPath(): string {
        return `${this.info.id}.json`;
    }

    remotePath(): string {
        return `manifests/leaderboards/scores/${this.info.id}.json`;
    }
}
