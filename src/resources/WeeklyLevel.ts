import { WeeklyLevelInfo } from "../LeaderboardInterface";
import { BaseLevel } from "./Level";
import { database } from "./Lmdb";

export class WeeklyLevel extends BaseLevel<WeeklyLevelInfo> {
    lmdbKey(): string {
        return `WC:${this.info.id}`;
    }

    //async process(remote: LevelLeaderboards) {
    /* const any = this.get(false);
        const anyNew = processRemoteLeaderboard(remote.any);
        const unbroken = this.get(true);
        const unbrokenNew = processRemoteLeaderboard(remote.unbroken);

        await database.transaction(async () => {
            await this.set(anyNew, false);
            await this.set(unbrokenNew, true);
        }); */
    //}

    remotePath(): string {
        return `manifests/leaderboards/challenges/scores/${this.info.id}.json`;
    }

    compactName(): string {
        return `Week ${this.info.week}`;
    }
}
