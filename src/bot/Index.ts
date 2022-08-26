import Eris from "eris";
import { BetterClient } from "./structures/Client";

require("dotenv").config();
const { botToken } = process.env;

export const otype = Eris.Constants.ApplicationCommandOptionTypes;

export const bot = new BetterClient(botToken, {
    intents: ["guilds"],
    restMode: true,
});

bot.start();
