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

interface LeaderboardOptions {
    unbroken: boolean;
    userFilter: UserFilter | null;
    price: number | null;
    rank: number | null;
}

function getBoardIndex(board: Leaderboard, options: LeaderboardOptions) {
    for (let i = 0; i < board.top1000.length; i++) {
        const entry = board.top1000[i];

        if (options.rank && entry.rank >= options.rank) return i;
        if (options.price && entry.score >= options.price) return i;
        if (options.userFilter && matchesUserFilter(options.userFilter, entry.owner)) return i;
    }

    return 0;
}

interface Data {
    level: WeeklyLevel;
    board: Leaderboard;
    comparisonBoard?: Leaderboard;
    options: LeaderboardOptions;
    updateTime: number;
}

class PagedLeaderboard extends PagedResponder {
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
        let board = this.data.comparisonBoard
            ? await renderBoardComparison(
                  {
                      entries: this.data.comparisonBoard.top1000,
                      label: `Week ${this.data.level.info.week - 100}`,
                  },
                  { entries: this.data.board.top1000, label: `Week ${this.data.level.info.week}` },
                  this.page * ENTRIES_PER_PAGE
              )
            : await renderBoard({ entries: this.data.board.top1000 }, this.page * ENTRIES_PER_PAGE);
        let shortTime = DateTime.fromMillis(this.data.updateTime).toRelative({ style: "short" });
        let uuid = uuidv4();

        let attachment = new AttachmentBuilder(board).setName(`${uuid}.png`);
        return {
            content: "",
            embeds: [
                {
                    title: `Leaderboard for Week ${this.data.level.info.week}${
                        this.data.options.unbroken ? " (unbroken)" : ""
                    }`,
                    description: `Showing top ${this.data.board.top1000.length.toLocaleString(
                        "en-US"
                    )} entries out of ${this.data.board.metadata.leaderboard_entry_count.toLocaleString(
                        "en-US"
                    )}.`,
                    color: 0x3586ff,
                    thumbnail: {
                        url: this.data.level.info.preview,
                    },
                    image: {
                        url: `attachment://${uuid}.png`,
                    },
                    footer: {
                        text: `Page ${this.page + 1}/${this.pageCount} • ${shortTime}`,
                    },
                    author: {
                        name: "PB2 Leaderboards Bot",
                        icon_url:
                            "https://cdn.discordapp.com/app-assets/720364938908008568/758752385244987423.png",
                    },
                },
            ],
            components: [arrowComponents],
            files: [attachment],
        };
    }
}

export default new Command({
    command: new SlashCommandBuilder()
        .setName("weekly")
        .setDescription("Shows the leaderboard for a campaign level")
        .setDMPermission(false)
        .addIntegerOption((option) =>
            option
                .setName("week")
                .setDescription("Week to display leaderboard for")
                .setMinValue(1)
                .setRequired(false)
        )
        .addBooleanOption((option) =>
            option
                .setName("unbroken")
                .setDescription("Show leaderboard for scores that didn't break")
                .setRequired(false)
        )
        .addStringOption((option) =>
            option.setName("user").setDescription("User to jump to").setRequired(false)
        )
        .addIntegerOption((option) =>
            option.setName("rank").setDescription("Rank to jump to").setRequired(false)
        )
        .addIntegerOption((option) =>
            option.setName("price").setDescription("Price to jump to").setRequired(false)
        )
        .toJSON(),
    run: async ({ interaction, client, args }) => {
        await interaction.deferReply();
        const week = args.getInteger("week", false);
        const unbroken = args.getBoolean("unbroken", false) ?? false;
        const user = args.getString("user", false);
        const rank = args.getInteger("rank", false);
        const price = args.getInteger("price", false);

        const level = week
            ? await cacheManager.weeklyManager.getByWeek(week)
            : await cacheManager.weeklyManager.getLatest();

        if (!level) {
            await error(interaction, "That week does not exist.");
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

        const board = level.get(unbroken);

        let comparisonBoard: Leaderboard | undefined;
        if (level.info.week > 100) {
            const comparisonLevel = await cacheManager.weeklyManager.getByWeek(
                level.info.week - 100
            );
            comparisonBoard = comparisonLevel?.get(unbroken);
        }

        const paged = new PagedLeaderboard(client, interaction, {
            level,
            board,
            comparisonBoard,
            options: { unbroken, userFilter, rank, price },
            updateTime: level.lastReloadTimeMs,
        });
        await paged.start();
    },
});
