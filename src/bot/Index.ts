import { ExtendedClient } from "./structures/Client";
import { cacheManager } from "../resources/CacheManager";
import { configureHttp } from "../resources/ConfigureHttpAgents";
import { GatewayIntentBits } from "discord.js";

require("dotenv").config();
const { botToken } = process.env;
configureHttp();

if (!botToken) {
    console.log("Missing botToken from dotenv.");
    process.exit(1);
}

export const bot = new ExtendedClient(botToken, [GatewayIntentBits.Guilds]);

cacheManager.backgroundUpdate();

bot.start();
