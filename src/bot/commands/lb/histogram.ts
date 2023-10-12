import { Leaderboard, LeaderboardType } from "../../../LeaderboardInterface";
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
import { N_ENTRIES as ENTRIES_PER_PAGE, WEEKLIES_PER_SEASON } from "../../../Consts";
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
import { getInterpolatedRank, getPercentile } from "../../../Milestones";
import { campaignBuckets, getWeeklyBucket } from "../../../resources/Buckets";
import { FormatScore } from "../../../utils/Format";
import { EMBED_AUTHOR, EMBED_COLOR } from "../../structures/EmbedStyles";

export default new Command({
    command: new SlashCommandBuilder()
        .setName("histogram")
        .setDescription("Shows the histogram for a leaderboard")
        .setDMPermission(false)
        .addStringOption((option) =>
            option
                .setName("level")
                .setDescription("Level identifier to display histogram for")
                .setRequired(false)
        )
        .addStringOption((option) =>
            option
                .setName("type")
                .setDescription("Leaderboard type to display")
                .setChoices(
                    { name: "any", value: "any" },
                    { name: "unbreaking", value: "unbreaking" },
                    { name: "stress", value: "stress" }
                )
                .setRequired(false)
        )
        .addNumberOption((option) =>
            option.setName("score").setDescription("Score to jump to").setRequired(false)
        )
        .addIntegerOption((option) =>
            option.setName("season").setDescription("Weekly Season").setRequired(false)
        )
        .addIntegerOption((option) =>
            option.setName("week").setDescription("Weekl").setRequired(false)
        )
        .toJSON(),
    run: async ({ interaction, client, args }) => {
        await interaction.deferReply();
        const l = args.getString("level", false);
        const levelCode = l ? parseLevelCode(l) : null;
        const type = (args.getString("type", false) ?? "any") as LeaderboardType;
        const season = args.getInteger("season", false);
        let week = args.getInteger("week", false);
        let score = args.getNumber("score", false);
        if (type === "stress" && score) score *= 100;

        if (!levelCode && !week) {
            await error(interaction, "Invalid level code.");
            return;
        } else if (season && !week) {
            await error(interaction, "You must specify a week as well as a season.");
        }

        if (week && season) {
            week = (season - 1) * WEEKLIES_PER_SEASON + week;
        }

        let level = week
            ? await cacheManager.campaignManager.getByWeek(week)
            : await cacheManager.campaignManager.getByCode(levelCode ?? "");
        if (!level) {
            await error(interaction, "Unknown level.");
            return;
        }

        const allBuckets = week
            ? await getWeeklyBucket(level as WeeklyLevel)
            : await campaignBuckets.get();

        const levelBuckets = allBuckets[level.info.id];

        if (!levelBuckets) {
            await error(interaction, "Not enough data to create histogram.");
            return;
        }

        const histogram_groups = collectBuckets(levelBuckets[type]);

        const options: RenderConfig = { levelBudget: level.info.budget, type };

        let additional_description = "";
        if (score !== null) {
            options.userScore = score;
            options.userPercentile = getPercentile(score, levelBuckets[type]);
            const estimated_rank = getInterpolatedRank(score, levelBuckets[type]);
            additional_description = `\nA score of \`${FormatScore(
                score,
                type
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
                        type !== "any" ? ` (${type})` : ""
                    }`,
                    description:
                        `This level has a budget of $${level.info.budget.toLocaleString(
                            "en-US"
                        )}.` + additional_description,
                    image: {
                        url: "attachment://percentiles.png",
                    },
                    color: EMBED_COLOR,
                    author: EMBED_AUTHOR,
                },
            ],
            files: [attachment],
        });
    },
});
