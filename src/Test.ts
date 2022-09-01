import { weeklyIndex } from "./resources/WeeklyIndex";
import { WeeklyLevel } from "./resources/WeeklyLevel";
import { cacheManager, CampaignManager, WeeklyManager } from "./resources/CacheManager";
import { campaignBuckets } from "./resources/Buckets";
import { configureHttp } from "./resources/ConfigureHttpAgents";
import { globalLeaderboard, GlobalScoreByBudget } from "./GlobalLeaderboard";
import { getProfile } from "./Profile";
import { sumOfBest } from "./SumOfBest";
import { getOldest, getTopUserStreaks, groupBy } from "./Oldest";
import { TIME_FORMAT } from "./Consts";
import { DateTime } from "luxon";
import { renderBoard } from "./TopLeaderboard";
import { findAllUsersWithUsername } from "./UserFinder";
import { userMatchesUsername } from "./utils/userFilter";

async function weeklyTest() {
    console.log(await weeklyIndex.lastReloadTime());
    let latest = await cacheManager.weeklyManager.getLatest();

    console.log(latest);
}

async function otherStuff() {
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
        scoreComputer: "moneyspent",
    });
    console.timeEnd("globalBoard");
    if (globalBoard) {
        console.log(`Global board, length: ${globalBoard.length}`);
        console.log(globalBoard[0]);
        console.log(globalBoard[1]);
    }

    console.time("profile");
    let myProfile = await getProfile({ by: "display_name", value: "Conqu3red" });
    console.timeEnd("profile");
    console.log(myProfile);
    if (myProfile) {
        console.log(myProfile.stats.globalPositions);
        console.log(myProfile.stats.scoreCounts[1]);
    }

    console.time("sumsOfBest");
    let sumsOfBest = await sumOfBest("any");
    console.timeEnd("sumsOfBest");
    console.log(sumsOfBest);

    console.log(groupBy([1, 1, 2, 3, 3], (obj) => obj));
}

(async () => {
    configureHttp();

    // await weeklyTest();
    // await otherStuff();

    await cacheManager.campaignManager.maybeReload();

    let level = await cacheManager.campaignManager.getByCode("1-1");

    if (level) {
        let board = (await level.get()).any;
        console.time("oldest");
        let t = getTopUserStreaks(board);
        console.timeEnd("oldest");
        if (t) {
            console.log(t.length);
            let now = DateTime.now();
            for (const user of t) {
                console.log(
                    `${Math.floor(
                        now.diff(DateTime.fromSeconds(user.initialTime)).as("days")
                    )}d ago: $${user.latestScore.value} (${user.latestScore.owner.display_name})`
                );
            }
        } else {
            console.log("no results");
        }

        renderBoard({ board }, 0);
    }

    console.time("full oldest");
    let oldestResults = await getOldest("any", {});
    console.timeEnd("full oldest");
    console.log(oldestResults.length);
    let now = DateTime.now();
    for (const user of oldestResults) {
        console.log(
            `${Math.floor(now.diff(DateTime.fromSeconds(user.initialTime)).as("days"))}d ago: $${
                user.latestScore.value
            } (${user.latestScore.owner.display_name})`
        );
        break;
    }

    console.log(
        "Users with name:",
        await findAllUsersWithUsername(cacheManager.campaignManager.campaignLevels, "alex")
    );
})();
