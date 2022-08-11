import { weeklyIndex } from "./resources/WeeklyIndex";
import { WeeklyLevel } from "./resources/WeeklyLevel";
import { CampaignManager, WeeklyManager } from "./resources/CacheManager";
import { campaignBuckets } from "./resources/Buckets";
import { configureHttp } from "./resources/ConfigureHttpAgents";

(async () => {
    configureHttp();

    let weeklyManager = new WeeklyManager();
    console.log(await weeklyIndex.lastReloadTime());
    let latest = await weeklyManager.getLatest();

    console.log(latest);

    let campaignManager = new CampaignManager();
    let level = await campaignManager.getByCode("1-1");
    console.log(level);
    if (level) {
        console.log(level.info);
    }

    await campaignBuckets.reload();
    let buckets = await campaignBuckets.get();
    let levelBuckets = buckets["mAp2V"];
    if (levelBuckets) {
        console.log(levelBuckets.any[0]);
    }
})();
