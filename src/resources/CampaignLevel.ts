import { LevelLeaderboards } from "../LeaderboardInterface";
import { BaseLevel } from "./Level";
import Remote from "../RemoteLeaderboardInterface";
import { CampaignLevelInfo } from "./CampaignIndex";
import { encodeLevelCode } from "../LevelCode";
import * as Local from "../LeaderboardInterface";
import database from "./Lmdb";
import { processRemoteLeaderboard, updateHistoryData } from "../LeaderboardProcessors";

export class CampaignLevel extends BaseLevel<CampaignLevelInfo> {
    lmdbKey(): string {
        return this.info.id;
    }

    async process(remote: Remote.LevelLeaderboards) {
        const any = this.get(false);
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
        });
    }

    remotePath(): string {
        return `manifests/leaderboards/scores/${this.info.id}.json`;
    }

    compactName(): string {
        return encodeLevelCode(this.info.code);
    }
}
