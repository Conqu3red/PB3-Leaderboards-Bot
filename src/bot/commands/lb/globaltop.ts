import { LeaderboardType } from "../../../LeaderboardInterface";
import { ExtendedClient } from "../../structures/Client";
import { Command } from "../../structures/Command";
import { v4 as uuidv4 } from "uuid";
import { arrowComponents, EditMessageType, PagedResponder } from "../../structures/PagedResponder";
import { error } from "../../utils/embeds";
import { N_ENTRIES as ENTRIES_PER_PAGE } from "../../../Consts";
import {
    GlobalEntry,
    globalLeaderboard,
    GlobalOptions,
    LevelCategory,
    renderGlobal,
    ScoringMode,
} from "../../../GlobalLeaderboard";
import { AttachmentBuilder, CommandInteraction, SlashCommandBuilder } from "discord.js";
import { matchesUserFilter, UserFilter } from "../../../utils/userFilter";
import { pickUserFilter, pickUserFilterError } from "../../utils/pickUserFilter";
import {
    formatManyWorldFilters,
    parseManyWorldFilters,
    parseWorldFilter,
    WorldFilter,
} from "../../../utils/WorldFilter";
import { EMBED_AUTHOR, EMBED_COLOR } from "../../structures/EmbedStyles";

interface LeaderboardOptions {
    globalOptions: GlobalOptions;
    userFilter: UserFilter | null;
    score: number | null;
    rank: number | null;
}

function getBoardIndex(board: GlobalEntry[], options: LeaderboardOptions) {
    for (let i = 0; i < board.length; i++) {
        const entry = board[i];

        if (options.rank && entry.rank === options.rank) return i;
        if (options.score && entry.value === options.score) return i;
        if (options.userFilter && matchesUserFilter(options.userFilter, entry.steam_id_user))
            return i;
    }

    return 0;
}

interface Data {
    board: GlobalEntry[];
    options: LeaderboardOptions;
}

class PagedGlobalLeaderboard extends PagedResponder {
    data: Data;
    constructor(client: ExtendedClient, interaction: CommandInteraction, data: Data) {
        let pageCount = Math.ceil(data.board.length / ENTRIES_PER_PAGE);
        super(client, interaction, pageCount);
        this.data = data;
        this.page = Math.floor(
            getBoardIndex(this.data.board, this.data.options) / ENTRIES_PER_PAGE
        );
    }

    getDetails() {
        let details: string[] = [];
        details.push(`${this.data.options.globalOptions.levelCategory} levels`);
        const worldFilters = this.data.options.globalOptions.worldFilters;
        if (worldFilters && worldFilters.length > 0) {
            const worlds = formatManyWorldFilters(worldFilters);
            details.push(`World ${worlds}`);
        }
        if (this.data.options.globalOptions.type != "any")
            details.push(this.data.options.globalOptions.type);
        return details.length === 0 ? "" : `(${details.join(", ")})`;
    }

    async generateMessage(): Promise<EditMessageType> {
        let board = await renderGlobal(
            this.data.board,
            this.page * ENTRIES_PER_PAGE,
            this.data.options.globalOptions
        );
        let uuid = uuidv4();
        let attachment = new AttachmentBuilder(board).setName(`${uuid}.png`);

        return {
            content: "",
            embeds: [
                {
                    title: `Global Leaderboard ${this.getDetails()}`,
                    description:
                        this.data.options.globalOptions.scoringMode === "rank"
                            ? "Global score calculated by rank."
                            : `Global score calculated by ${
                                  this.data.options.globalOptions.type === "stress"
                                      ? "stress"
                                      : "budget"
                              }.`,
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
        .setName("globaltop")
        .setDescription("Shows the global leaderboard")
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
            option.setName("user").setDescription("User to jump to").setRequired(false)
        )
        .addIntegerOption((option) =>
            option.setName("rank").setDescription("Rank to jump to").setRequired(false)
        )
        .addNumberOption((option) =>
            option.setName("score").setDescription("Score to jump to").setRequired(false)
        )
        .addStringOption((option) =>
            option
                .setName("world")
                .setDescription("Display for specific world(s)")
                .setRequired(false)
        )
        .addStringOption((option) =>
            option
                .setName("scoring_mode")
                .setDescription("Calculate based on rank or budget/stress (default: by rank)")
                .setChoices({ name: "rank", value: "rank" }, { name: "score", value: "score" })
                .setRequired(false)
        )
        .toJSON(),
    run: async ({ interaction, client, args }) => {
        await interaction.deferReply();
        const type = (args.getString("type", false) ?? "any") as LeaderboardType;
        const user = args.getString("user", false);
        const rank = args.getInteger("rank", false);
        let score = args.getNumber("score", false);
        const world = args.getString("world", false);
        const scoringMode = (args.getString("scoring_mode", false) ?? "rank") as ScoringMode;

        if (type === "stress" && score) score *= 100;

        let worldFilters: WorldFilter[] = [];
        if (world) {
            worldFilters = parseManyWorldFilters(world);
            if (worldFilters.length === 0) {
                await error(interaction, "Invalid world.");
                return;
            }
        }

        const globalOptions: GlobalOptions = {
            type,
            levelCategory: "all",
            worldFilters: worldFilters,
            scoringMode,
        };

        let userFilter: UserFilter | null = null;
        if (user) {
            userFilter = await pickUserFilter(user);
            if (!userFilter) {
                await pickUserFilterError(interaction);
                return;
            }
        }

        const board = await globalLeaderboard(globalOptions);
        if (!board) {
            await error(interaction, "Invalid argument combination");
            return;
        }

        const paged = new PagedGlobalLeaderboard(client, interaction, {
            board,
            options: { globalOptions, userFilter, rank, score },
        });
        await paged.start();
    },
});
