import { LeaderboardType } from "../../../LeaderboardInterface";
import { encodeLevelCode, parseLevelCode, World, WORLDS } from "../../../LevelCode";
import { cacheManager } from "../../../resources/CacheManager";
import { ExtendedClient } from "../../structures/Client";
import { Command } from "../../structures/Command";
import { v4 as uuidv4 } from "uuid";
import { arrowComponents, EditMessageType, PagedResponder } from "../../structures/PagedResponder";
import { error } from "../../utils/embeds";
import { AttachmentBuilder, CommandInteraction, SlashCommandBuilder } from "discord.js";

import { EMBED_AUTHOR, EMBED_COLOR } from "../../structures/EmbedStyles";
import {
    PER_PAGE,
    Timeline,
    getGlobalTimeline,
    getSumOfBestTimeline,
    getTimeline,
    renderTimeline,
} from "../../../History";
import { ScoringMode } from "../../../GlobalLeaderboard";
import { parseWorldFilter } from "../../../utils/WorldFilter";

interface Data {
    timeline: Timeline;
    includeTies: boolean;
    type: LeaderboardType;
    scoringMode: ScoringMode;
    title: string;
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
        let timeline = await renderTimeline(
            this.data.timeline,
            this.page,
            this.data.type,
            this.data.scoringMode
        );
        let uuid = uuidv4();

        let attachment = new AttachmentBuilder(timeline).setName(`${uuid}.png`);
        return {
            content: "",
            embeds: [
                {
                    title: this.data.title,
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
        .setDescription("View a timeline")
        .setDMPermission(false)
        .addSubcommand((group) =>
            group
                .setName("level")
                .setDescription("Timeline of the top score history for a level")
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
                        .setDescription(
                            "Include events when a user ties first place (default: false)"
                        )
                        .setRequired(false)
                )
        )
        .addSubcommand((group) =>
            group
                .setName("global")
                .setDescription("Timeline of globaltop")
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
                        .setDescription("Display for specific world")
                        .setChoices(...WORLDS.map((w) => ({ name: w, value: w })))
                        .setRequired(false)
                )
                .addStringOption((option) =>
                    option
                        .setName("scoring_mode")
                        .setDescription(
                            "Calculate based on rank or budget/stress (default: by rank)"
                        )
                        .setChoices(
                            { name: "rank", value: "rank" },
                            { name: "score", value: "score" }
                        )
                        .setRequired(false)
                )
                .addStringOption((option) =>
                    option
                        .setName("include_ties")
                        .setDescription(
                            "Include events when a user ties first place (default: false)"
                        )
                        .setRequired(false)
                )
        )
        .addSubcommand((group) =>
            group
                .setName("sumofbest")
                .setDescription("Timeline of sum of best scores")
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
                        .setDescription("Display for specific world")
                        .setChoices(...WORLDS.map((w) => ({ name: w, value: w })))
                        .setRequired(false)
                )
                .addStringOption((option) =>
                    option
                        .setName("include_ties")
                        .setDescription(
                            "Include events when a user ties first place (default: false)"
                        )
                        .setRequired(false)
                )
        )
        .toJSON(),
    run: async ({ interaction, client, args }) => {
        await interaction.deferReply();
        const subcommand = args.getSubcommand(true);

        let includeTies: boolean = false;
        let timeline: Timeline;
        let type: LeaderboardType;
        let scoringMode: ScoringMode = "score";
        let title: string = "";
        if (subcommand === "level") {
            const levelCode = parseLevelCode(args.getString("level", true));
            type = (args.getString("type", false) ?? "any") as LeaderboardType;
            includeTies = args.getBoolean("includeTies", false) ?? false;

            if (!levelCode) {
                await error(interaction, "Invalid level code.");
                return;
            }

            const level = await cacheManager.campaignManager.getByCode(levelCode);
            if (!level) {
                await error(interaction, "Unknown level.");
                return;
            }

            timeline = getTimeline(level, type, includeTies);
            title = `Timeline for ${encodeLevelCode(level.info.code)}: ${
                level.info.name
            } (${type})`;
        } else if (subcommand == "global") {
            type = (args.getString("type", false) ?? "any") as LeaderboardType;
            const world = args.getString("world", false);
            scoringMode = (args.getString("scoring_mode", false) ?? "rank") as ScoringMode;
            includeTies = args.getBoolean("includeTies", false) ?? false;

            let parsedWorld: World | null = null;

            if (world) {
                const filter = parseWorldFilter(world);
                if (filter) {
                    parsedWorld = filter;
                } else {
                    await error(interaction, "Invalid world.");
                }
            }

            timeline = getGlobalTimeline(type, parsedWorld, scoringMode, includeTies);

            const by = scoringMode === "rank" ? "rank" : type === "stress" ? "stress" : "budget";
            title = `Timeline for Global leaderboard (${type}, by ${by}, world: ${world ?? "all"})`;
        } else {
            type = (args.getString("type", false) ?? "any") as LeaderboardType;
            const world = args.getString("world", false);
            includeTies = args.getBoolean("includeTies", false) ?? false;

            let parsedWorld: World | null = null;

            if (world) {
                const filter = parseWorldFilter(world);
                if (filter) {
                    parsedWorld = filter;
                } else {
                    await error(interaction, "Invalid world.");
                }
            }

            timeline = getSumOfBestTimeline(type, parsedWorld, includeTies);
            title = `Timeline for Sum Of Best (${type}, world: ${world ?? "all"})`;
        }

        if (timeline.groups.length === 0) {
            await error(
                interaction,
                "No score history data is available using the parameters specified."
            );
            return;
        }

        timeline.groups.reverse();

        const pagedResponder = new PagedTimeline(client, interaction, {
            timeline,
            includeTies,
            type,
            title,
            scoringMode,
        });
        await pagedResponder.start();
    },
});
