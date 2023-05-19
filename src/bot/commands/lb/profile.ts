import { LeaderboardType } from "../../../LeaderboardInterface";
import { ExtendedClient } from "../../structures/Client";
import { Command } from "../../structures/Command";
import { v4 as uuidv4 } from "uuid";
import { arrowComponents, EditMessageType, PagedResponder } from "../../structures/PagedResponder";
import { error } from "../../utils/embeds";
import { N_ENTRIES as ENTRIES_PER_PAGE } from "../../../Consts";
import { GlobalEntry } from "../../../GlobalLeaderboard";
import {
    getProfile,
    Options,
    Profile,
    renderProfileLevelScores,
    ScoreCount,
    scoreCountThresholds,
} from "../../../Profile";
import { AttachmentBuilder, CommandInteraction, EmbedField, SlashCommandBuilder } from "discord.js";
import { UserFilter } from "../../../utils/userFilter";
import {
    pickUserFilter,
    pickUserFilterError,
    userMatchesDiscordID,
} from "../../utils/pickUserFilter";
import { FormatScore } from "../../../utils/Format";
import SteamUsernames from "../../../resources/SteamUsernameHandler";
import { steamUser } from "../../../resources/SteamUser";
import { EMBED_AUTHOR, EMBED_COLOR } from "../../structures/EmbedStyles";

interface LeaderboardOptions {
    profileOptions: Options;
}

interface Data {
    profile: Profile;
    options: LeaderboardOptions;
}

class PagedProfileLeaderboard extends PagedResponder {
    data: Data;
    username: string;
    constructor(client: ExtendedClient, interaction: CommandInteraction, data: Data) {
        let pageCount = 1 + Math.ceil(data.profile.stats.levelScores.length / ENTRIES_PER_PAGE);
        super(client, interaction, pageCount);
        this.data = data;
        this.page = 0;

        this.username = SteamUsernames.get(this.data.profile.steam_id_user);
    }

    getDetails() {
        let details: string[] = [];
        if (this.data.options.profileOptions.type !== "any")
            details.push(this.data.options.profileOptions.type);
        return details.length === 0 ? "" : `(${details.join(", ")})`;
    }

    generateGlobalPositionsPart(): string {
        const p = this.data.profile.stats.globalPositions;
        const keys: (keyof typeof p)[] = ["all"];

        const formatPart = (name: string, entry: GlobalEntry | null) =>
            entry
                ? `${name}: #${entry.rank.toLocaleString("en-US")} (${FormatScore(
                      entry.value,
                      this.data.options.profileOptions.type
                  )})`
                : ``;

        return keys.map((k) => formatPart(k, p[k])).join("\n");
    }

    generateScoreCountPart(): string {
        return scoreCountThresholds
            .map((t) => `Top ${t}: \`${this.data.profile.stats.scoreCounts[t].overall}\``)
            .join("\n");
    }

    generateScoreCountParts(): EmbedField {
        return {
            name: `Top Scores`,
            value: this.generateScoreCountPart(),
            inline: true,
        };
    }

    generateIdField(): EmbedField {
        return {
            name: `Steam ID`,
            value: `\`${this.data.profile.steam_id_user}\`\n[**View Steam Profile**](https://steamcommunity.com/profiles/${this.data.profile.steam_id_user})`,
            inline: true,
        };
    }

    async generateStatsMessage(): Promise<EditMessageType> {
        const globalPosField: EmbedField = {
            name: "Global Leaderboard Positions",
            value: "```" + this.generateGlobalPositionsPart() + "```",
            inline: false,
        };

        const scoreCountField = this.generateScoreCountParts();
        const idField = this.generateIdField();

        return {
            content: "",
            embeds: [
                {
                    title: `Profile Stats - \`${this.username}\` ${this.getDetails()}`,
                    description: `Showing Stats page. Press :arrow_forward: in reactions to see scores for each level.`,
                    fields: [globalPosField, scoreCountField, idField],
                    footer: {
                        text: `Page ${this.page + 1}/${this.pageCount}`,
                    },
                    color: EMBED_COLOR,
                    author: EMBED_AUTHOR,
                },
            ],
            components: [arrowComponents],
            files: [],
        };
    }

    async generateLevelScoresMessage(): Promise<EditMessageType> {
        let image = await renderProfileLevelScores(
            this.data.profile.stats.levelScores,
            (this.page - 1) * ENTRIES_PER_PAGE,
            this.data.options.profileOptions
        );
        let uuid = uuidv4();
        let attachment = new AttachmentBuilder(image).setName(`${uuid}.png`);

        return {
            content: "",
            embeds: [
                {
                    title: `Profile - \`${this.username}\` ${this.getDetails()}`,
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

    async generateMessage(): Promise<EditMessageType> {
        if (this.page === 0) return await this.generateStatsMessage();
        return await this.generateLevelScoresMessage();
    }
}

export default new Command({
    command: new SlashCommandBuilder()
        .setName("profile")
        .setDescription("Get the overall profile for a user")
        .setDMPermission(false)
        .addStringOption((option) =>
            option.setName("user").setDescription("User to show profile of").setRequired(false)
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
        .toJSON(),
    run: async ({ interaction, client, args }) => {
        await interaction.deferReply();
        const user = args.getString("user", false);
        const type = (args.getString("type", false) ?? "any") as LeaderboardType;

        const profileOptions: Options = {
            type,
        };

        let userFilter: UserFilter | null = null;
        if (user) {
            userFilter = await pickUserFilter(user);
        } else {
            userFilter = await userMatchesDiscordID(interaction.user.id);
        }
        if (!userFilter) {
            await pickUserFilterError(interaction);
            return;
        }

        const profile = await getProfile(userFilter, profileOptions);
        if (!profile) {
            await error(
                interaction,
                "User not found. They have no scores in the top 1000 on any level."
            );
            return;
        }

        const paged = new PagedProfileLeaderboard(client, interaction, {
            profile,
            options: { profileOptions },
        });
        await paged.start();
    },
});
