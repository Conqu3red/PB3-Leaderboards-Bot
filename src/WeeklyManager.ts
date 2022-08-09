import { CDN_URL, DATA_DIR } from "./Consts";
import { weeklyIndex } from "./resources/WeeklyIndex";
import { WeeklyLevel } from "./resources/WeeklyLevel";

export class WeeklyManager {
    static WEEKLY_RELOAD_INTERVAL = 60 * 60 * 1000;
    weeklyLevels: Map<number, WeeklyLevel> = new Map();

    async populate() {
        if (await weeklyIndex.needsReload()) {
            await weeklyIndex.reload();
        }
        let levels = await weeklyIndex.get();
        for (const levelInfo of levels) {
            const level = new WeeklyLevel(levelInfo, WeeklyManager.WEEKLY_RELOAD_INTERVAL);
            this.weeklyLevels.set(levelInfo.week, level);
        }
    }

    async getLatest(): Promise<WeeklyLevel | null> {
        await this.populate();
        let week = Math.max(...this.weeklyLevels.keys());
        let level = this.weeklyLevels.get(week);
        return level ?? null;
    }

    async getByWeek(week: number): Promise<WeeklyLevel | null> {
        await this.populate();
        let level = this.weeklyLevels.get(week);
        return level ?? null;
    }
}
