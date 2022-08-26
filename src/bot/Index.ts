import Eris from "eris";
import { BetterClient } from "./structures/Client";
import { promisify } from "util";
import { glob } from "glob";
const globPromise = promisify(glob);

require("dotenv").config();
const { botToken } = process.env;

export const otype = Eris.Constants.ApplicationCommandOptionTypes;

if (!botToken) {
    console.log("Missing botToken from dotenv.");
    process.exit(1);
}

export const bot = new BetterClient(botToken, {
    intents: ["guilds"],
    restMode: true,
});

bot.start();
