import { AttachmentBuilder } from "discord.js";
import { NewScore, renderNewScore } from "../NewScore";
import { v4 as uuidv4 } from "uuid";
import { EMBED_AUTHOR, EMBED_COLOR } from "./structures/EmbedStyles";
import { ExtendedClient } from "./structures/Client";

require("dotenv").config();
const { ALERTS_CHANNEL } = process.env;

export async function sendNewScores(bot: ExtendedClient, newScores: NewScore[]) {
    console.log(`Announcing ${newScores.length} new best scores`);
    const channelId = ALERTS_CHANNEL || "756163803967651861";
    const channel = bot.channels.cache.get(channelId);
    if (channel && channel.isSendable()) {
        let board = await renderNewScore(newScores);
        let uuid = uuidv4();

        let attachment = new AttachmentBuilder(board).setName(`${uuid}.png`);
        channel.send({
            content: "",
            embeds: [
                {
                    title: `New #1 Scores`,
                    image: {
                        url: `attachment://${uuid}.png`,
                    },
                    color: EMBED_COLOR,
                    author: EMBED_AUTHOR
                },
            ],
            components: [],
            files: [attachment],
        });
    }
}

