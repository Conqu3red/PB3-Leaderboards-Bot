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
import { N_ENTRIES as ENTRIES_PER_PAGE, OLDEST_RANK_LIMIT } from "../../../Consts";
import { AttachmentBuilder, CommandInteraction, SlashCommandBuilder } from "discord.js";
import { getRecent, RecentEntry, renderRecent } from "../../../Recent";
import { getOldest, PopulatedOldestEntry, renderOldest } from "../../../Oldest";
import { UserFilter } from "../../../utils/userFilter";
import { pickUserFilter, pickUserFilterError } from "../../utils/pickUserFilter";
import { EMBED_AUTHOR, EMBED_COLOR } from "../../structures/EmbedStyles";

interface LeaderboardOptions {
    type: LeaderboardType;
}

interface Data {
    board: PopulatedOldestEntry[];
    options: LeaderboardOptions;
}

class PagedLeaderboard extends PagedResponder {
    data: Data;
    constructor(client: ExtendedClient, interaction: CommandInteraction, data: Data) {
        let pageCount = Math.ceil(data.board.length / ENTRIES_PER_PAGE);
        super(client, interaction, pageCount);
        this.data = data;
        this.page = 0;
    }

    async generateMessage(): Promise<EditMessageType> {
        let board = await renderOldest(this.data.board, this.page * ENTRIES_PER_PAGE);
        let uuid = uuidv4();

        let attachment = new AttachmentBuilder(board).setName(`${uuid}.png`);
        return {
            content: "",
            embeds: [
                {
                    title: `Oldest Leaderboard${
                        this.data.options.type !== "any" ? ` (${this.data.options.type})` : ""
                    }`,
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
        .setName("oldest")
        .setDescription(`Shows the oldest records on all levels. `)
        .setDMPermission(false)
        .addStringOption((option) =>
            option
                .setName("level")
                .setDescription("Level identifier to display leaderboard for")
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
        .addStringOption((option) =>
            option.setName("user").setDescription("User to show").setRequired(false)
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
        const levelCode = args.getString("level", false);
        const type = (args.getString("type", false) ?? "any") as LeaderboardType;
        const user = args.getString("user", false) ?? undefined;
        const includeTies = args.getBoolean("include_ties", false) ?? false;

        let userFilter: UserFilter | null = null;
        if (user) {
            userFilter = await pickUserFilter(user);
            if (!userFilter) {
                await pickUserFilterError(interaction);
                return;
            }
        }

        const paged = new PagedLeaderboard(client, interaction, {
            board: await getOldest(type, {
                levelCode: levelCode ? parseLevelCode(levelCode) ?? undefined : undefined,
                userFilter: userFilter ?? undefined,
                includeTies,
            }),
            options: { type },
        });
        await paged.start();
    },
});
