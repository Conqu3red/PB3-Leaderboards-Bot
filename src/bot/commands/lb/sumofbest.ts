import { Leaderboard, LeaderboardType } from "../../../LeaderboardInterface";
import { encodeLevelCode, LevelCode, World } from "../../../LevelCode";
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
import { parseManyWorldFilters } from "../../../utils/WorldFilter";
import { FormatScore } from "../../../utils/Format";
import { EMBED_AUTHOR, EMBED_COLOR } from "../../structures/EmbedStyles";

export default new Command({
    command: new SlashCommandBuilder()
        .setName("sumofbest")
        .setDescription("Shows the sum of best scores")
        .setDMPermission(false)
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
        .addStringOption((option) =>
            option
                .setName("world")
                .setDescription("Display for specific world(s)")
                .setRequired(false)
        )
        .toJSON(),
    run: async ({ interaction, client, args }) => {
        await interaction.deferReply();
        const type = (args.getString("type", false) ?? "any") as LeaderboardType;
        const world = args.getString("world", false);

        let worldFilters: World[] = [];
        if (world) {
            worldFilters = parseManyWorldFilters(world);
            if (worldFilters.length === 0) {
                await error(interaction, "Invalid world.");
                return;
            }
        }

        const sumsOfBest = await sumOfBest(type, worldFilters);

        const worlds = `World: ${worldFilters.join(", ")}`;

        await interaction.editReply({
            embeds: [
                {
                    title: `Sum of best${type !== "any" ? ` (${type})` : ""} ${
                        worldFilters.length > 0 ? worlds : ""
                    }`,
                    description: `Aggregated from \`${
                        sumsOfBest.levelCount
                    }\` levels.\nOverall: \`${FormatScore(sumsOfBest.overall, type)}\``,
                    color: EMBED_COLOR,
                    author: EMBED_AUTHOR,
                },
            ],
        });
    },
});
