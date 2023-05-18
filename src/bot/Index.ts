import { ExtendedClient } from "./structures/Client";
import { cacheManager } from "../resources/CacheManager";
import { configureHttp } from "../resources/ConfigureHttpAgents";
import { GatewayIntentBits } from "discord.js";
import { sequelize } from "./Sequelize";
import User from "./models/User";
import SteamWebAPI from "@doctormckay/steam-webapi";
import { ExpandedSteamUser } from "../Steam";
import { steamAPI, steamUser } from "../resources/SteamUser";

require("dotenv").config();
const { botToken, STEAM_WEBAPI_KEY, STEAM_USERNAME, STEAM_PASSWORD } = process.env;
configureHttp();

if (!botToken) {
    console.log("Missing botToken from dotenv.");
    process.exit(1);
}

export const bot = new ExtendedClient(botToken, [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
]);

sequelize.sync();

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
    console.log("[Steam] logged in to steam.");
    // FIXME: steam relogin, handle offline properly

    bot.start();
    await Promise.all([cacheManager.backgroundUpdate(), cacheManager.nameUpdate()]);
});
