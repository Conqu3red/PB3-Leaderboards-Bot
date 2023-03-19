import { Leaderboard } from "../../../LeaderboardInterface";
import { encodeLevelCode, LevelCode, parseLevelCode } from "../../../LevelCode";
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
import {
    getAllPercentiles,
    getHistogramBuckets,
    getPercentileForScore,
    renderHistogram,
    renderPercentiles,
} from "../../../Milestones";

export default new Command({
    command: new SlashCommandBuilder()
        .setName("histogram")
        .setDescription("Shows the histogram of a campaign leaderboard's scores")
        .setDMPermission(false)
        .addStringOption((option) =>
            option
                .setName("level")
                .setDescription("Level identifier to display leaderboard for")
                .setRequired(true)
        )
        .addBooleanOption((option) =>
            option
                .setName("unbroken")
                .setDescription("Show leaderboard for scores that didn't break")
                .setRequired(false)
        )
        .addIntegerOption((option) =>
            option.setName("price").setDescription("Price to jump to").setRequired(false)
        )
        .toJSON(),
    run: async ({ interaction, client, args }) => {
        await interaction.deferReply();
        const levelCode = parseLevelCode(args.getString("level", true));
        const unbroken = args.getBoolean("unbroken", false) ?? false;
        const price = args.getInteger("price", false);

        if (!levelCode) {
            await error(interaction, "Invalid level code.");
            return;
        }

        const level = await cacheManager.campaignManager.getByCode(levelCode);
        if (!level) {
            await error(interaction, "Unknown level.");
            return;
        }

        if (price !== null) {
            // return detail on this price's milestone position
            // TODO: implement
            /* const details = await getPercentileForScore(
                level,
                unbroken ? "unbroken" : "any",
                price
            );

            if (!details) {
                await error(interaction, "Milestones for the level could not be found.");
                return;
            }

            await interaction.editReply({
                embeds: [
                    {
                        title: `Milestones for ${level.compactName()}: ${level.info.name}${
                            unbroken ? " (unbroken)" : ""
                        }`,
                        description: `A score of \`$${price.toLocaleString(
                            "en-US"
                        )}\` is in the top \`${
                            details.percentile
                        }%\`, with an estimated rank of \`#${details.interpolatedRank.toLocaleString(
                            "en-US"
                        )}\`.`,
                        color: 0x3586ff,
                        author: {
                            name: "PB2 Leaderboards Bot",
                            icon_url:
                                "https://cdn.discordapp.com/app-assets/720364938908008568/758752385244987423.png",
                        },
                    },
                ],
            }); */
        } else {
            const histogram_groups = await getHistogramBuckets(
                level,
                unbroken ? "unbroken" : "any",
                20
            );
            if (!histogram_groups) {
                await error(interaction, "Milestones for the level could not be found.");
                return;
            }
            const image = await renderHistogram(histogram_groups, level.info.budget);
            const attachment = new AttachmentBuilder(image).setName(`percentiles.png`);

            await interaction.editReply({
                embeds: [
                    {
                        title: `Histogram for ${level.compactName()}${
                            unbroken ? " (unbroken)" : ""
                        }`,
                        description: `This level has a budget of $${level.info.budget.toLocaleString(
                            "en-US"
                        )}.`,
                        color: 0x3586ff,
                        image: {
                            url: "attachment://percentiles.png",
                        },
                        author: {
                            name: "PB2 Leaderboards Bot",
                            icon_url:
                                "https://cdn.discordapp.com/app-assets/720364938908008568/758752385244987423.png",
                        },
                    },
                ],
                files: [attachment],
            });
        }
    },
});
