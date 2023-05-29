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
import { getInterpolatedRank, getPercentile } from "../../../Milestones";
import { campaignBuckets } from "../../../resources/Buckets";
import { FormatScore } from "../../../utils/Format";
import { EMBED_AUTHOR, EMBED_COLOR } from "../../structures/EmbedStyles";
import { PER_PAGE, Timeline, getTimeline, renderTimeline } from "../../../History";

interface Data {
    timeline: Timeline;
    level: CampaignLevel;
    includeTies: boolean;
    type: LeaderboardType;
}

class PagedTimeline extends PagedResponder {
    data: Data;
    constructor(client: ExtendedClient, interaction: CommandInteraction, data: Data) {
        let pageCount = Math.ceil(data.timeline.groups.length / PER_PAGE);
        super(client, interaction, pageCount);
        this.data = data;
        this.page = 0;
    }

    async generateMessage(): Promise<EditMessageType> {
        let timeline = await renderTimeline(this.data.timeline, this.page, this.data.type);
        let uuid = uuidv4();

        let attachment = new AttachmentBuilder(timeline).setName(`${uuid}.png`);
        return {
            content: "",
            embeds: [
                {
                    title: `Timeline for ${encodeLevelCode(this.data.level.info.code)}: ${
                        this.data.level.info.name
                    }${this.data.type !== "any" ? ` (${this.data.type})` : ""}`,
                    description: `${
                        this.data.includeTies ? "Includes" : "Excludes"
                    } events for users tying with the top score but not overtaking it.`,
                    image: {
                        url: `attachment://${uuid}.png`,
                    },
                    footer: {
                        text: `Page ${this.page + 1}/${this.pageCount}`,
                    },
                    color: EMBED_COLOR,
                    author: EMBED_AUTHOR,
                },
            ],
            components: [arrowComponents],
            files: [attachment],
        };
    }
}

export default new Command({
    command: new SlashCommandBuilder()
        .setName("history")
        .setDescription("Timeline of the top score history for a level")
        .setDMPermission(false)
        .addStringOption((option) =>
            option
                .setName("level")
                .setDescription("Level identifier to display histogram for")
                .setRequired(true)
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
        .addBooleanOption((option) =>
            option
                .setName("include_ties")
                .setDescription("Include events when a user ties first place (default: false)")
                .setRequired(false)
        )
        .toJSON(),
    run: async ({ interaction, client, args }) => {
        await interaction.deferReply();
        const levelCode = parseLevelCode(args.getString("level", true));
        const type = (args.getString("type", false) ?? "any") as LeaderboardType;
        const includeTies = args.getBoolean("includeTies", false) ?? false;

        if (!levelCode) {
            await error(interaction, "Invalid level code.");
            return;
        }

        const level = await cacheManager.campaignManager.getByCode(levelCode);
        if (!level) {
            await error(interaction, "Unknown level.");
            return;
        }

        const timeline = getTimeline(level, type, includeTies);

        if (timeline.groups.length === 0) {
            await error(
                interaction,
                "No score history data is available using the parameters specified."
            );
            return;
        }

        const pagedResponder = new PagedTimeline(client, interaction, {
            level,
            timeline,
            includeTies,
            type,
        });
        await pagedResponder.start();
    },
});
