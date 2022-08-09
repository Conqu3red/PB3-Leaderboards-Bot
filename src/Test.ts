import { weeklyIndex } from "./resources/WeeklyIndex";
import { WeeklyLevel } from "./resources/WeeklyLevel";
import { WeeklyManager } from "./WeeklyManager";

(async () => {
    let weeklyManager = new WeeklyManager();
    console.log(await weeklyIndex.lastReloadTime());
    let latest = await weeklyManager.getLatest();

    console.log(latest);
})();
