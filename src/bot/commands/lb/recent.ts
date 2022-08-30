import { Leaderboard } from "../../../LeaderboardInterface";
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

interface LeaderboardOptions {
    unbroken: boolean;
}

interface Data {
    board: RecentEntry[];
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
        let board = await renderRecent(this.data.board, this.page * ENTRIES_PER_PAGE);
        let uuid = uuidv4();

        let attachment = new AttachmentBuilder(board).setName(`${uuid}.png`);
        return {
            content: "",
            embeds: [
                {
                    title: `Most recent top scores in the top ${OLDEST_RANK_LIMIT}${
                        this.data.options.unbroken ? " (unbroken)" : ""
                    }`,
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
            components: [arrowComponents],
            files: [attachment],
        };
    }
}

export default new Command({
    command: new SlashCommandBuilder()
        .setName("recent")
        .setDescription(`Shows the most recent top ${OLDEST_RANK_LIMIT} entries for all levels. `)
        .setDMPermission(false)
        .addStringOption((option) =>
            option
                .setName("level")
                .setDescription("Level identifier to display leaderboard for")
                .setRequired(false)
        )
        .addBooleanOption((option) =>
            option
                .setName("unbroken")
                .setDescription("Show leaderboard for scores that didn't break")
                .setRequired(false)
        )
        .addStringOption((option) =>
            option.setName("user").setDescription("User to show").setRequired(false)
        )
        .toJSON(),
    run: async ({ interaction, client, args }) => {
        await interaction.deferReply();
        const levelCode = args.getString("level", false);
        const unbroken = args.getBoolean("unbroken", false) ?? false;
        const user = args.getString("user", false) ?? undefined;

        const paged = new PagedLeaderboard(client, interaction, {
            board: await getRecent(unbroken ? "unbroken" : "any", {
                levelCode: levelCode ? parseLevelCode(levelCode) ?? undefined : undefined,
                user: user,
            }),
            options: { unbroken },
        });
        await paged.start();
    },
});
