import { promises as fs } from "fs";
import { CampaignLevelInfo, LevelLeaderboards } from "./LeaderboardInterface";
import { CampaignLevel } from "./CampaignLevel";

(async () => {
    let a: LevelLeaderboards = JSON.parse(await fs.readFile("data/mAp2V.json", "utf-8"));

    console.log(a.any.metadata.uniqueRanksCount);

    let levelInfo: CampaignLevelInfo = {
        id: "mAp2V",
        identifier: {world: 1, level: 1, isChallenge: false},
        title: "Ten Meter Simple Bridge",
        budget: 10_000
    };

    let level = new CampaignLevel(levelInfo, 8 * 60 * 60 * 60 * 1000);

    const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

    console.log("Blank LB:")

    await level.reload_using({
        any: {top1000: [], metadata: {uniqueRanksCount: 1}},
        unbroken: {top1000: [], metadata: {uniqueRanksCount: 1}}
    }, false);

    console.log("1st LB:")
    
    await level.reload_using({
        any: {top1000: [
            {
                id: "1",
                value: 100,
                didBreak: false,
                owner: {id: "o1", display_name: "owner1"},
            }
        ], metadata: {uniqueRanksCount: 1}},
        unbroken: {top1000: [], metadata: {uniqueRanksCount: 1}}
    });

    await sleep(1000);

    console.log("2nd LB (score increased):")
    
    await level.reload_using({
        any: {top1000: [
            {
                id: "2",
                value: 110,
                didBreak: false,
                owner: {id: "o1", display_name: "owner1"},
            }
        ], metadata: {uniqueRanksCount: 1}},
        unbroken: {top1000: [], metadata: {uniqueRanksCount: 1}}
    });

    await sleep(1000);

    console.log("3rd LB (score gone):")
    
    await level.reload_using({
        any: {top1000: [], metadata: {uniqueRanksCount: 0}},
        unbroken: {top1000: [], metadata: {uniqueRanksCount: 0}}
    });
    
    let data = await level.getLeaderboard();

    /* console.log(data.any.metadata.uniqueRanksCount);
    console.log(data.any.top1000[0]); */
})();