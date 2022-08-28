import Eris from "eris";
import { BetterClient } from "./structures/Client";
import { promisify } from "util";
import { glob } from "glob";
import { cacheManager } from "../resources/CacheManager";
import { configureHttp } from "../resources/ConfigureHttpAgents";
const globPromise = promisify(glob);

require("dotenv").config();
const { botToken } = process.env;
configureHttp();

export const otype = Eris.Constants.ApplicationCommandOptionTypes;

if (!botToken) {
    console.log("Missing botToken from dotenv.");
    process.exit(1);
}

export const bot = new BetterClient(botToken, {
    intents: ["guilds"],
    restMode: true,
});

cacheManager.backgroundUpdate();

bot.start();
