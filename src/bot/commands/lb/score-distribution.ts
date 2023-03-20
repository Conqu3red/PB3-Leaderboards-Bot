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
    collectBuckets,
    getHistogramBuckets,
    RenderConfig,
    renderHistogram,
} from "../../../ScoreDistribution";
import { getInterpolatedRank, getPercentile, implyMissingBuckets } from "../../../Milestones";
import { campaignBuckets } from "../../../resources/Buckets";

export default new Command({
    command: new SlashCommandBuilder()
        .setName("score-distribution")
        .setDescription("Shows the score distribution of a campaign leaderboard's scores")
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
        .addIntegerOption((option) =>
            option
                .setName("resolution")
                .setDescription("Number of bars in the emitted chart (default: 40)")
                .setRequired(false)
                .setMinValue(20)
                .setMaxValue(100)
        )
        .addBooleanOption((option) =>
            option
                .setName("extended")
                .setDescription("Render chart from 2x budget to $0")
                .setRequired(false)
        )
        .toJSON(),
    run: async ({ interaction, client, args }) => {
        await interaction.deferReply();
        const levelCode = parseLevelCode(args.getString("level", true));
        const unbroken = args.getBoolean("unbroken", false) ?? false;
        const price = args.getInteger("price", false);
        const resolution = args.getInteger("resolution", false) ?? 40;
        const extended = args.getBoolean("extended", false) ?? false;

        if (!levelCode) {
            await error(interaction, "Invalid level code.");
            return;
        }

        const level = await cacheManager.campaignManager.getByCode(levelCode);
        if (!level) {
            await error(interaction, "Unknown level.");
            return;
        }

        const allBuckets = await campaignBuckets.get();
        const levelBuckets = allBuckets[level.info.id];

        if (!levelBuckets) {
            await error(interaction, "Milestones for the level could not be found.");
            return;
        }

        const buckets = implyMissingBuckets(levelBuckets[unbroken ? "unbroken" : "any"]);
        const histogram_groups = collectBuckets(buckets, resolution, level.info.budget, extended);

        const options: RenderConfig = { levelBudget: level.info.budget };

        let additional_description = "";
        if (price) {
            options.userScore = price;
            options.userPercentile = getPercentile(price, buckets);
            const estimated_rank = getInterpolatedRank(price, buckets);
            additional_description = `\nA score of \`$${price.toLocaleString(
                "en-US"
            )}\` would rank approximately \`#${estimated_rank.toLocaleString("en-US")}\` - Top ${
                options.userPercentile
            }%`;
        }

        const image = await renderHistogram(histogram_groups, options);

        const attachment = new AttachmentBuilder(image).setName(`percentiles.png`);

        await interaction.editReply({
            embeds: [
                {
                    title: `Score Distribution for ${level.compactName()}${
                        unbroken ? " (unbroken)" : ""
                    }`,
                    description:
                        `This level has a budget of $${level.info.budget.toLocaleString(
                            "en-US"
                        )}.` + additional_description,
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
    },
});
