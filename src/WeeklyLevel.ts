import { CDN_URL, DATA_DIR } from "./Consts";
import { LevelLeaderboards, WeeklyLevelInfo } from "./LeaderboardInterface";
import { BaseLevel, fetchRemoteLeaderboard } from "./Level";
import { Remote } from "./RemoteLeaderboardInterface";
import fs from "fs";
import path from "path";
import { processRemoteLeaderboard } from "./LeaderboardProcessors";

function filenameFromWeeklyLevelInfo(level: WeeklyLevelInfo): string {
    return path.join(DATA_DIR, `WC.${level.id}.json`);
}

export class WeeklyLevel extends BaseLevel {
    info: WeeklyLevelInfo;

    static generateLevelDownloadUrl(id: string) {
        return `${CDN_URL}/manifests/leaderboards/challenges/scores/${id}.json`;
    }

    constructor(info: WeeklyLevelInfo, reloadIntervalMs: number) {
        super(reloadIntervalMs);
        this.info = info;
    }

    async reload() {
        // TODO
        let leaderboards = await fetchRemoteLeaderboard(
            WeeklyLevel.generateLevelDownloadUrl(this.info.id)
        );

        this.reload_using(leaderboards);
    }

    async reload_using(leaderboards: Remote.LevelLeaderboards) {
        let current = await this.getLeaderboard();

        let processed: LevelLeaderboards = {
            any: processRemoteLeaderboard(leaderboards.any),
            unbroken: processRemoteLeaderboard(leaderboards.unbroken),
        };

        // Weekly levels do not keep track of oldest data.

        this.cachedLeaderboard = processed;

        //await this.saveCachedLeaderboard();
    }

    file(): string {
        return filenameFromWeeklyLevelInfo(this.info);
    }
}
