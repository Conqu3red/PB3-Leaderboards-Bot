import Eris from "eris";
import { Leaderboard } from "../../../LeaderboardInterface";
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
    user?: string;
    price?: number;
    rank?: number;
}

function getBoardIndex(board: Leaderboard, options: LeaderboardOptions) {
    // TODO: search for discord user and search for user ID
    let user_lower = options.user?.toLowerCase();
    for (let i = 0; i < board.top1000.length; i++) {
        const entry = board.top1000[i];

        if (options.rank && entry.rank === options.rank) return i;
        if (options.price && entry.value === options.price) return i;
        if (user_lower && entry.owner.display_name.toLocaleLowerCase() == user_lower) return i;
    }

    return 0;
}

interface Data {
    level: CampaignLevel;
    board: Leaderboard;
    options: LeaderboardOptions;
}

class PagedLeaderboard extends PagedResponder {
    data: Data;
    constructor(client: BetterClient, interaction: Eris.CommandInteraction, data: Data) {
        let pageCount = Math.ceil(data.board.top1000.length / ENTRIES_PER_PAGE);
        super(client, interaction, pageCount);
        this.data = data;
        this.page = Math.floor(
            getBoardIndex(this.data.board, this.data.options) / ENTRIES_PER_PAGE
        );
    }

    async generateMessage(): Promise<GeneratedMessage> {
        let board = await renderBoard(this.data.board, this.page * ENTRIES_PER_PAGE);
        let updateTime = await this.data.level.lastReloadTime();
        let shortTime = DateTime.fromMillis(updateTime).toRelative({ style: "short" });
        let uuid = uuidv4();
        return {
            content: {
                content: "",
                embeds: [
                    {
                        title: `Leaderboard for ${encodeLevelCode(this.data.level.info.code)}`,
                        color: 0x3586ff,
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
    name: "leaderboard",
    description: "Shows the leaderboard for a campaign level",
    type: Eris.Constants.ApplicationCommandTypes.CHAT_INPUT,
    dmPermission: false,
    options: [
        {
            name: "level",
            description: "Level identifier to display leaderboard for",
            type: Eris.Constants.ApplicationCommandOptionTypes.STRING,
            required: true,
        },
        {
            name: "unbroken",
            description: "Show leaderboard for scores that didn't break",
            type: Eris.Constants.ApplicationCommandOptionTypes.BOOLEAN,
            required: false,
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
            name: "price",
            description: "Price to jump to",
            type: Eris.Constants.ApplicationCommandOptionTypes.STRING,
            required: false,
        },
    ],
    run: async ({ interaction, client }) => {
        await interaction.defer();
        const levelCode = getOptionValue<string>(interaction.data.options, "level");
        const unbroken = getOptionValue<boolean>(interaction.data.options, "unbroken") ?? false;
        const user = getOptionValue<string>(interaction.data.options, "user");
        const rank = getOptionValue<number>(interaction.data.options, "rank");
        const price = getOptionValue<number>(interaction.data.options, "price");

        if (!levelCode) {
            await error(interaction, "No level code specified");
            return;
        }

        const level = await cacheManager.campaignManager.getByCode(levelCode);
        if (!level) {
            await error(interaction, "Unknown level.");
            return;
        }
        const boards = await level.get();
        const board = unbroken ? boards.unbroken : boards.any;

        const paged = new PagedLeaderboard(client, interaction, {
            level,
            board,
            options: { user, rank, price },
        });
        await paged.start();
    },
});
