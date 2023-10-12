import { Leaderboard, LeaderboardEntry, LeaderboardType } from "../../../LeaderboardInterface";
import { encodeLevelCode, LevelCode, parseLevelCode } from "../../../LevelCode";
import { cacheManager } from "../../../resources/CacheManager";
import { CampaignLevel, isCampgainLevel } from "../../../resources/CampaignLevel";
import { renderBoard, renderBoardComparison } from "../../../TopLeaderboard";
import { ExtendedClient } from "../../structures/Client";
import { Command } from "../../structures/Command";
import { v4 as uuidv4 } from "uuid";
import { DateTime } from "luxon";
import { arrowComponents, EditMessageType, PagedResponder } from "../../structures/PagedResponder";
import { error } from "../../utils/embeds";
import { N_ENTRIES as ENTRIES_PER_PAGE, WEEKLIES_PER_SEASON } from "../../../Consts";
import { AttachmentBuilder, CommandInteraction, SlashCommandBuilder } from "discord.js";
import { matchesUserFilter, UserFilter } from "../../../utils/userFilter";
import { pickUserFilter, pickUserFilterError } from "../../utils/pickUserFilter";
import { EMBED_AUTHOR, EMBED_COLOR } from "../../structures/EmbedStyles";
import { WeeklyLevel } from "../../../resources/WeeklyLevel";
import { PagedLeaderboard } from "./leaderboard";

export default new Command({
    command: new SlashCommandBuilder()
        .setName("weekly")
        .setDescription("Shows the leaderboard for a weekly level")
        .setDMPermission(false)
        .addIntegerOption((option) =>
            option.setName("season").setDescription("Weekly Season").setRequired(true)
        )
        .addIntegerOption((option) =>
            option.setName("week").setDescription("Week").setRequired(true)
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
        .addStringOption((option) =>
            option.setName("user").setDescription("User to jump to").setRequired(false)
        )
        .addIntegerOption((option) =>
            option.setName("rank").setDescription("Rank to jump to").setRequired(false)
        )
        .addNumberOption((option) =>
            option.setName("score").setDescription("Score to jump to").setRequired(false)
        )
        .toJSON(),
    run: async ({ interaction, client, args }) => {
        await interaction.deferReply();
        const season = args.getInteger("season", true);
        let week = args.getInteger("week", true);
        const type = (args.getString("type", false) ?? "any") as LeaderboardType;
        const user = args.getString("user", false);
        const rank = args.getInteger("rank", false);
        let score = args.getNumber("score", false);
        if (type === "stress" && score) score *= 100;

        if (week && season) {
            week = (season - 1) * WEEKLIES_PER_SEASON + week;
        }

        let userFilter: UserFilter | null = null;
        if (user) {
            userFilter = await pickUserFilter(user);
            if (!userFilter) {
                await pickUserFilterError(interaction);
                return;
            }
        }

        const level = await cacheManager.campaignManager.getByWeek(week);

        if (!level) {
            await error(interaction, "Unknown level.");
            return;
        }
        const board = level.get(type);

        const paged = new PagedLeaderboard(client, interaction, {
            level,
            board,
            options: { type, userFilter, rank, price: score },
            updateTime: level.lastReloadTimeMs,
        });
        await paged.start();
    },
});
