import { ExtendedClient } from "./structures/Client";
import { cacheManager } from "../resources/CacheManager";
import { configureHttp } from "../resources/ConfigureHttpAgents";
import { GatewayIntentBits } from "discord.js";
import { sequelize } from "./Sequelize";
import User from "./models/User";

require("dotenv").config();
const { botToken } = process.env;
configureHttp();

if (!botToken) {
    console.log("Missing botToken from dotenv.");
    process.exit(1);
}

export const bot = new ExtendedClient(botToken, [GatewayIntentBits.Guilds]);

sequelize.sync();
cacheManager.backgroundUpdate();

/* (async () => {
    await sequelize.sync();
    let a = User.build({ discordID: "abc", polyBridgeID: "abc" });

    console.log(a);
    console.log(a.get());
    await a.save();
})(); */

bot.start();
