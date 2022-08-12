import { weeklyIndex } from "./resources/WeeklyIndex";
import { WeeklyLevel } from "./resources/WeeklyLevel";
import { cacheManager, CampaignManager, WeeklyManager } from "./resources/CacheManager";
import { campaignBuckets } from "./resources/Buckets";
import { configureHttp } from "./resources/ConfigureHttpAgents";
import { globalLeaderboard, GlobalScoreByBudget } from "./GlobalLeaderboard";
import { getProfile } from "./Profile";

(async () => {
    configureHttp();

    console.log(await weeklyIndex.lastReloadTime());
    let latest = await cacheManager.weeklyManager.getLatest();

    console.log(latest);

    let level = await cacheManager.campaignManager.getByCode("1-1");
    console.log(level);

    await campaignBuckets.reload();
    let buckets = await campaignBuckets.get();
    let levelBuckets = buckets["mAp2V"];
    if (levelBuckets) {
        console.log(levelBuckets.any[0]);
    }

    console.time("globalBoard");
    let globalBoard = await globalLeaderboard({
        type: "any",
        levelCategory: "all",
        scoreComputer: GlobalScoreByBudget,
    });
    console.timeEnd("globalBoard");
    if (globalBoard) {
        console.log(`Global board, length: ${globalBoard.length}`);
        console.log(globalBoard[0]);
        console.log(globalBoard[1]);
    }

    console.time("profile");
    let myProfile = await getProfile("Conqu3red");
    console.timeEnd("profile");
    console.log(myProfile);
    if (myProfile) {
        console.log(myProfile.stats.globalPositions);
        console.log(myProfile.stats.scoreCounts[1]);
    }
})();
