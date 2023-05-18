import { cacheManager } from "./resources/CacheManager";
import SteamWebAPI from "@doctormckay/steam-webapi";
import { ExpandedSteamUser } from "./Steam";
import { asyncSetTimeout } from "./utils/asyncTimeout";
import { steamAPI, steamUser } from "./resources/SteamUser";

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

    await Promise.all([cacheManager.backgroundUpdate(), cacheManager.nameUpdate()]);
});
