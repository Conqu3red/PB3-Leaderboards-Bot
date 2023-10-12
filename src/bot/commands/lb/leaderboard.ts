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

interface LeaderboardOptions {
    type: LeaderboardType;
    userFilter: UserFilter | null;
    price: number | null;
    rank: number | null;
}

function getBoardIndex(board: Leaderboard, options: LeaderboardOptions) {
    for (let i = 0; i < board.top1000.length; i++) {
        const entry = board.top1000[i];

        if (options.rank && entry.rank >= options.rank) return i;
        if (options.price && entry.score >= options.price) return i;
        if (options.userFilter && matchesUserFilter(options.userFilter, entry.steam_id_user))
            return i;
    }

    return 0;
}

interface Data {
    level: CampaignLevel | WeeklyLevel;
    board: Leaderboard;
    options: LeaderboardOptions;
    updateTime: number;
}

export class PagedLeaderboard extends PagedResponder {
    data: Data;
    constructor(client: ExtendedClient, interaction: CommandInteraction, data: Data) {
        let pageCount = Math.ceil(data.board.top1000.length / ENTRIES_PER_PAGE);
        super(client, interaction, pageCount);
        this.data = data;
        this.page = Math.floor(
            getBoardIndex(this.data.board, this.data.options) / ENTRIES_PER_PAGE
        );
    }

    async generateMessage(): Promise<EditMessageType> {
        let board = await renderBoard(
            { entries: this.data.board.top1000, type: this.data.options.type },
            this.page * ENTRIES_PER_PAGE
        );
        let shortTime = DateTime.fromMillis(this.data.updateTime).toRelative({ style: "short" });
        let uuid = uuidv4();

        let attachment = new AttachmentBuilder(board).setName(`${uuid}.png`);
        return {
            content: "",
            embeds: [
                {
                    title: `Leaderboard for ${this.data.level.compactName()}: ${this.data.level.fullName()}${
                        this.data.options.type !== "any" ? ` (${this.data.options.type})` : ""
                    }`,
                    description: `Showing top ${this.data.board.top1000.length.toLocaleString(
                        "en-US"
                    )} entries out of ${this.data.board.leaderboard_entry_count.toLocaleString(
                        "en-US"
                    )} unique ranks.`,
                    image: {
                        url: `attachment://${uuid}.png`,
                    },
                    footer: {
                        text: `Page ${this.page + 1}/${this.pageCount} • ${shortTime}`,
                    },
                    color: EMBED_COLOR,
                    author: EMBED_AUTHOR,
                    ...(!isCampgainLevel(this.data.level) && {
                        thumbnail: { url: this.data.level.info.preview },
                    }),
                },
            ],
            components: [arrowComponents],
            files: [attachment],
        };
    }
}

export default new Command({
    command: new SlashCommandBuilder()
        .setName("leaderboard")
        .setDescription("Shows the leaderboard for a campaign level")
        .setDMPermission(false)
        .addStringOption((option) =>
            option
                .setName("level")
                .setDescription("Level identifier to display leaderboard for")
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
        const levelCode = parseLevelCode(args.getString("level", true));
        const type = (args.getString("type", false) ?? "any") as LeaderboardType;
        const user = args.getString("user", false);
        const rank = args.getInteger("rank", false);
        let score = args.getNumber("score", false);
        if (type === "stress" && score) score *= 100;

        if (!levelCode) {
            await error(interaction, "Invalid level code.");
            return;
        }

        let userFilter: UserFilter | null = null;
        if (user) {
            userFilter = await pickUserFilter(user);
            if (!userFilter) {
                await pickUserFilterError(interaction);
                return;
            }
        }

        const level = await cacheManager.campaignManager.getByCode(levelCode);

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
