import { LevelLeaderboards, WeeklyLevelInfo } from "../LeaderboardInterface";
import { BaseLevel } from "./Level";
import { Remote } from "../RemoteLeaderboardInterface";
import { processRemoteLeaderboard } from "../LeaderboardProcessors";

export class WeeklyLevel extends BaseLevel {
    info: WeeklyLevelInfo;

    constructor(info: WeeklyLevelInfo, reloadIntervalMs: number) {
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

        // Weekly levels do not keep track of oldest data.

        return processed;
    }

    localPath(): string {
        return `WC.${this.info.id}.json`;
    }

    remotePath(): string {
        return `manifests/leaderboards/challenges/scores/${this.info.id}.json`;
    }

    compactName(): string {
        return `Week ${this.info.week}`;
    }
}
