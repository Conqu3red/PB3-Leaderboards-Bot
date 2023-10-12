import { cacheManager } from "./resources/CacheManager";
import SteamWebAPI from "@doctormckay/steam-webapi";
import { ExpandedSteamUser } from "./resources/Steam";
import { asyncSetTimeout } from "./utils/asyncTimeout";
import { steamAPI, steamUser } from "./resources/SteamUser";
import SteamUser from "steam-user";
import { weeklyIndex } from "./resources/WeeklyIndex";

require("dotenv").config();
const { STEAM_WEBAPI_KEY, STEAM_USERNAME, STEAM_PASSWORD } = process.env;

/* (async () => {
    await sequelize.sync();
    let a = User.build({ discordID: "abc", polyBridgeID: "abc" });

    console.log(a);
    console.log(a.get());
    await a.save();
})(); */

steamAPI.key = STEAM_WEBAPI_KEY;

steamUser.logOn({
    accountName: STEAM_USERNAME,
    password: STEAM_PASSWORD,
});

steamUser.on("loggedOn", async (details) => {
    console.log("Steam user logged in!");
    console.log(details);

    await asyncSetTimeout(2000);

    await cacheManager.campaignManager.populate();

    const level = cacheManager.campaignManager.getByCode("CR-01");
    if (level) {
        const board = level.get("any");
        board.top1000.push({ steam_id_user: "1", didBreak: false, score: 5, rank: 1 });
        board.top1000.push({ steam_id_user: "2", didBreak: false, score: 10, rank: 2 });
        level.lastReloadTimeMs = 0;
        await level.set(board, "any");
    }

    const board = await steamUser.GetLeaderboard("2998255038");
    const entries = await steamUser.GetLeaderboardEntries(
        board.leaderboard_id,
        0,
        10,
        SteamUser.ELeaderboardDataRequest.Global
    );
    console.log(entries);

    const fileDetails = await steamUser.getPublishedFileDetails(2998255038);
    console.log(fileDetails);

    console.log(await weeklyIndex.get());

    //await Promise.all([cacheManager.backgroundUpdate(), cacheManager.nameUpdate()]);
});
