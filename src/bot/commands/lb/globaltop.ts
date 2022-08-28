import Eris from "eris";
import { Leaderboard, LeaderboardType } from "../../../LeaderboardInterface";
import { encodeLevelCode, LevelCode } from "../../../LevelCode";
import { cacheManager } from "../../../resources/CacheManager";
import { CampaignLevel } from "../../../resources/CampaignLevel";
import { renderBoard } from "../../../TopLeaderboard";
import { BetterClient } from "../../structures/Client";
import { BCommand } from "../../structures/Command";
import { v4 as uuidv4 } from "uuid";
import { DateTime } from "luxon";
import { arrowComponents, GeneratedMessage, PagedResponder } from "../../structures/PagedResponder";
import { error } from "../../utils/embeds";
import { N_ENTRIES as ENTRIES_PER_PAGE } from "../../../Consts";
import {
    GlobalEntry,
    globalLeaderboard,
    GlobalOptions,
    GlobalScoreByBudget,
    GlobalScoreByRank,
    LevelCategory,
    renderGlobal,
} from "../../../GlobalLeaderboard";
import { BaseLevel } from "../../../resources/Level";

function tryGetOption(
    options: Eris.InteractionDataOptions[] | undefined,
    name: string
): Eris.InteractionDataOptions | undefined {
    return options?.find((o) => o.name == name);
}

function getOptionValue<T>(
    options: Eris.InteractionDataOptions[] | undefined,
    name: string
): T | undefined {
    return tryGetOption(options, name)?.value as T | undefined;
}

interface LeaderboardOptions {
    globalOptions: GlobalOptions;
    moneyspent: boolean;
    unbroken: boolean;
    user?: string;
    score?: number;
    rank?: number;
}

function getBoardIndex(board: GlobalEntry[], options: LeaderboardOptions) {
    // TODO: search for discord user and search for user ID
    let user_lower = options.user?.toLowerCase();
    for (let i = 0; i < board.length; i++) {
        const entry = board[i];

        if (options.rank && entry.rank === options.rank) return i;
        if (options.score && entry.value === options.score) return i;
        if (user_lower && entry.user.display_name.toLocaleLowerCase() == user_lower) return i;
    }

    return 0;
}

interface Data {
    board: GlobalEntry[];
    options: LeaderboardOptions;
}

class PagedGlobalLeaderboard extends PagedResponder {
    data: Data;
    constructor(client: BetterClient, interaction: Eris.CommandInteraction, data: Data) {
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
        if (this.data.options.unbroken) details.push("unbroken");
        return details.join(", ");
    }

    async generateMessage(): Promise<GeneratedMessage> {
        let board = await renderGlobal(
            this.data.board,
            this.page * ENTRIES_PER_PAGE,
            this.data.options.globalOptions
        );
        let uuid = uuidv4();
        return {
            content: {
                content: "",
                embeds: [
                    {
                        title: `Global Leaderboard - ${this.getDetails()}`,
                        color: 0x3586ff,
                        image: {
                            url: `attachment://${uuid}.png`,
                        },
                        footer: {
                            text: `Page ${this.page + 1}/${this.pageCount}`,
                        },
                        author: {
                            name: "PB2 Leaderboards Bot",
                            icon_url:
                                "https://cdn.discordapp.com/app-assets/720364938908008568/758752385244987423.png",
                        },
                    },
                ],
                components: arrowComponents,
            },
            file: [
                {
                    name: `${uuid}.png`,
                    file: board,
                },
            ],
        };
    }
}

export default new BCommand({
    name: "globaltop",
    description: "Shows the global leaderboard",
    type: Eris.Constants.ApplicationCommandTypes.CHAT_INPUT,
    dmPermission: false,
    options: [
        {
            name: "unbroken",
            description: "Show leaderboard for scores that didn't break",
            type: Eris.Constants.ApplicationCommandOptionTypes.BOOLEAN,
            required: false,
        },
        {
            name: "type",
            description: "Type of levels to show global leaderboard for",
            type: Eris.Constants.ApplicationCommandOptionTypes.STRING,
            required: false,
            choices: [
                { name: "all", value: "all" },
                { name: "regular", value: "regular" },
                { name: "challenge", value: "challenge" },
                { name: "weekly", value: "weekly" },
            ],
        },
        {
            name: "user",
            description: "User to jump to",
            type: Eris.Constants.ApplicationCommandOptionTypes.STRING,
            required: false,
        },
        {
            name: "rank",
            description: "Rank to jump to",
            type: Eris.Constants.ApplicationCommandOptionTypes.STRING,
            required: false,
        },
        {
            name: "score",
            description: "Price to jump to",
            type: Eris.Constants.ApplicationCommandOptionTypes.STRING,
            required: false,
        },
        {
            name: "moneyspent",
            description: "Display total money spent",
            type: Eris.Constants.ApplicationCommandOptionTypes.BOOLEAN,
            required: false,
        },
    ],
    run: async ({ interaction, client }) => {
        await interaction.defer();
        const category = getOptionValue<LevelCategory>(interaction.data.options, "type") ?? "all";
        const unbroken = getOptionValue<boolean>(interaction.data.options, "unbroken") ?? false;
        const user = getOptionValue<string>(interaction.data.options, "user");
        const rank = getOptionValue<number>(interaction.data.options, "rank");
        const score = getOptionValue<number>(interaction.data.options, "score");
        const moneyspent = getOptionValue<boolean>(interaction.data.options, "moneyspent") ?? false;

        const type: LeaderboardType = unbroken ? "unbroken" : "any";
        const globalOptions: GlobalOptions = {
            type,
            levelCategory: category,
            scoreComputer: moneyspent ? "moneyspent" : "rank",
        };

        const board = await globalLeaderboard(globalOptions);
        if (!board) {
            await error(interaction, "Invalid argument combination");
            return;
        }

        const paged = new PagedGlobalLeaderboard(client, interaction, {
            board,
            options: { globalOptions, moneyspent, unbroken, user, rank, score },
        });
        await paged.start();
    },
});
