import SteamWebAPI from "@doctormckay/steam-webapi";
import { ExpandedSteamUser, GetPublishedFileDetails, LookupUsers } from "./resources/Steam";
import { cacheManager } from "./resources/CacheManager";
import { weeklyIndex } from "./resources/WeeklyIndex";
import { steamAPI } from "./resources/SteamUser";
import SteamUser from "steam-user";
import { campaignBuckets, getWeeklyBucket } from "./resources/Buckets";

require("dotenv").config();
const { STEAM_WEBAPI_KEY, STEAM_USERNAME, STEAM_PASSWORD } = process.env;

var user = new ExpandedSteamUser({
    dataDirectory: ".",
});

steamAPI.key = STEAM_WEBAPI_KEY;

user.logOn({
    accountName: STEAM_USERNAME,
    password: STEAM_PASSWORD,
});

user.on("loggedOn", async (details) => {
    console.log("Logged in!");
    console.log(details);

    await new Promise((resolve) => setTimeout(resolve, 2000));

    /*let r = await user.GetLeaderboard("014");
    console.log(r);

    let r2 = await user.GetLeaderboard("00_mAp2V_wrong_any");
    console.log(r2);*/

    /* await weeklyIndex.reload();
    const index = await weeklyIndex.get();
    console.log(index.at(-1)); */

    await cacheManager.campaignManager.populate();
    /* const level = cacheManager.campaignManager.getByCode("MM-08");
    if (level) {
        const boardId = await cacheManager.campaignManager.getLeaderboardId(level, "any");
        if (boardId) {
            const res = await user.GetLeaderboardEntries(
                boardId,
                0,
                100,
                SteamUser.ELeaderboardDataRequest.Users,
                ["76561199062811258"]
            );
            console.log(res);
        }
    } */

    /* const level = cacheManager.campaignManager.getByWeek(157);
    if (level) {
        const bucket = await getWeeklyBucket(level);
        console.log(bucket);
    }

    await campaignBuckets.reload(); */

    const level = cacheManager.campaignManager.getByCode("1-10c");
    if (level) {
        await level.setHistory([], "any");
        await level.set({top1000: [], leaderboard_entry_count: 0}, "any");
        console.log("Cleared");
    }

    //console.log(await GetPublishedFileDetails(steamAPI, ["3728158173"]));
    
    /* api.get(
        "IPublishedFileService",
        "GetDetails",
        1,
        {
            publishedfileids: ["3728158173"],
        },
        (err, response) => {
            if (err != null) {
                console.log(err);
                console.log(response);
            }

            console.log(response);
        }
    ); */

    /*

    let entryResult = await user.GetLeaderboardEntries(
        r.leaderboard_id,
        0,
        1000,
        ExpandedSteamUser.ELeaderboardDataRequest.Global
    );
    console.log(entryResult);

    console.log("Trying to lookup users...");
    let lookupIds = entryResult.entries.map((entry) => entry.steam_id_user).slice(0,90);
    //console.log(lookupIds);

    let userResult = await LookupUsers(
        api,
        lookupIds,
        user.cellID
    );
    //console.log(userResult);

    let idToNames = new Map();
    for (const user of userResult.players) {
        idToNames.set(user.steamid, user.personaname);
    }

    for (const entry of entryResult.entries) {
        console.log(
            entry.global_rank,
            idToNames.get(entry.steam_id_user),
            entry.score,
            entry.details != null && entry.details.readUInt32LE(0) != 0 ? "*" : ""
        );
    }
    */

    user.logOff();
});
