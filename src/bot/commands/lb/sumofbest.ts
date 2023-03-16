import { Leaderboard } from "../../../LeaderboardInterface";
import { encodeLevelCode, LevelCode } from "../../../LevelCode";
import { cacheManager } from "../../../resources/CacheManager";
import { CampaignLevel } from "../../../resources/CampaignLevel";
import { renderBoard, renderBoardComparison } from "../../../TopLeaderboard";
import { ExtendedClient } from "../../structures/Client";
import { Command } from "../../structures/Command";
import { v4 as uuidv4 } from "uuid";
import { DateTime } from "luxon";
import { arrowComponents, EditMessageType, PagedResponder } from "../../structures/PagedResponder";
import { error } from "../../utils/embeds";
import { N_ENTRIES as ENTRIES_PER_PAGE } from "../../../Consts";
import { AttachmentBuilder, CommandInteraction, SlashCommandBuilder } from "discord.js";
import { WeeklyLevel } from "../../../resources/WeeklyLevel";
import { matchesUserFilter, UserFilter } from "../../../utils/userFilter";
import { pickUserFilter, pickUserFilterError } from "../../utils/pickUserFilter";
import { sumOfBest } from "../../../SumOfBest";

export default new Command({
    command: new SlashCommandBuilder()
        .setName("sumofbest")
        .setDescription("Shows the sum of best scores")
        .setDMPermission(false)
        .addBooleanOption((option) =>
            option
                .setName("unbroken")
                .setDescription("Show leaderboard for scores that didn't break")
                .setRequired(false)
        )
        .toJSON(),
    run: async ({ interaction, client, args }) => {
        await interaction.deferReply();
        const unbroken = args.getBoolean("unbroken", false) ?? false;

        const sumsOfBest = await sumOfBest(unbroken ? "unbroken" : "any");

        await interaction.editReply({
            embeds: [
                {
                    title: `Sum of best${unbroken ? " (unbroken)" : ""}`,
                    description:
                        `Overall: \`$${sumsOfBest.overall.toLocaleString("en-US")}\`\n` +
                        `Regular: \`$${sumsOfBest.regular.toLocaleString("en-US")}\`\n` +
                        `Challenge: \`$${sumsOfBest.challenge.toLocaleString("en-US")}\`\n` +
                        `Bonus: \`$${sumsOfBest.bonus.toLocaleString("en-US")}\`\n`,
                    color: 0x3586ff,
                    author: {
                        name: "PB2 Leaderboards Bot",
                        icon_url:
                            "https://cdn.discordapp.com/app-assets/720364938908008568/758752385244987423.png",
                    },
                },
            ],
        });
    },
});
