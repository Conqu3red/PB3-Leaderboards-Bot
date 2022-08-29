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
import {
    getProfile,
    Options,
    Profile,
    renderProfileLevelScores,
    ScoreCount,
    scoreCountThresholds,
} from "../../../Profile";

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
    profileOptions: Options;
}

/* function getBoardIndex(board: GlobalEntry[], options: LeaderboardOptions) {
    // TODO: search for discord user and search for user ID
    let user_lower = options.user?.toLowerCase();
    for (let i = 0; i < board.length; i++) {
        const entry = board[i];

        if (options.rank && entry.rank === options.rank) return i;
        if (options.score && entry.value === options.score) return i;
        if (user_lower && entry.user.display_name.toLocaleLowerCase() == user_lower) return i;
    }

    return 0;
} */

interface Data {
    profile: Profile;
    options: LeaderboardOptions;
}

class PagedProfileLeaderboard extends PagedResponder {
    data: Data;
    constructor(client: BetterClient, interaction: Eris.CommandInteraction, data: Data) {
        let pageCount = 1 + Math.ceil(data.profile.stats.levelScores.length / ENTRIES_PER_PAGE);
        super(client, interaction, pageCount);
        this.data = data;
        this.page = 0;
    }

    getDetails() {
        let details: string[] = [];
        if (this.data.options.profileOptions.type === "unbroken") details.push("unbroken");
        return details.length === 0 ? "" : `(${details.join(", ")})`;
    }

    generateGlobalPositionsPart(): string {
        const p = this.data.profile.stats.globalPositions;
        const keys: (keyof typeof p)[] = ["all", "regular", "challenge", "weekly"];

        const formatPart = (name: string, entry: GlobalEntry | null) =>
            entry ? `${name}: #${entry.rank} (${entry.value})` : ``;

        return keys.map((k) => formatPart(k, p[k])).join("\n");
    }

    generateScoreCountPart(scoreCount: ScoreCount): string {
        const keys: (keyof ScoreCount)[] = ["overall", "regular", "challenge", "weekly"];
        return keys.map((k) => `${k}: \`${scoreCount[k]}\``).join("\n");
    }

    generateScoreCountParts(): Eris.EmbedField[] {
        return scoreCountThresholds.map((t) => {
            return {
                name: `Top ${t}s`,
                value: this.generateScoreCountPart(this.data.profile.stats.scoreCounts[t]),
                inline: true,
            };
        });
    }

    async generateStatsMessage(): Promise<GeneratedMessage> {
        const globalPosField: Eris.EmbedField = {
            name: "Global Leaderboard Positions",
            value: "```" + this.generateGlobalPositionsPart() + "```",
        };

        const scoreCountFields = this.generateScoreCountParts();

        return {
            content: {
                content: "",
                embeds: [
                    {
                        title: `Profile (Stats) - \`${
                            this.data.profile.user.display_name
                        }\`, ID: \`${this.data.profile.user.id}\` ${this.getDetails()}`,
                        description: `Showing Stats page. Press :arrow_forward: in reactions to see scores for each level.`,
                        color: 0x3586ff,
                        fields: [globalPosField, ...scoreCountFields],
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
        };
    }

    async generateLevelScoresMessage(): Promise<GeneratedMessage> {
        let image = await renderProfileLevelScores(
            this.data.profile.stats.levelScores,
            (this.page - 1) * ENTRIES_PER_PAGE,
            this.data.options.profileOptions
        );
        let uuid = uuidv4();
        return {
            content: {
                content: "",
                embeds: [
                    {
                        title: `Profile - \`${
                            this.data.profile.user.display_name
                        }\` ${this.getDetails()}`,
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
                    file: image,
                },
            ],
        };
    }

    async generateMessage(): Promise<GeneratedMessage> {
        if (this.page === 0) return await this.generateStatsMessage();
        return await this.generateLevelScoresMessage();
    }
}

export default new BCommand({
    name: "profile",
    description: "Get the overall profile for a user",
    type: Eris.Constants.ApplicationCommandTypes.CHAT_INPUT,
    dmPermission: false,
    options: [
        {
            name: "user",
            description: "User to show profile of",
            type: Eris.Constants.ApplicationCommandOptionTypes.STRING,
            required: true, // TODO: make false
        },
        {
            name: "unbroken",
            description: "Show profile for scores that didn't break",
            type: Eris.Constants.ApplicationCommandOptionTypes.BOOLEAN,
            required: false,
        },
    ],
    run: async ({ interaction, client }) => {
        await interaction.defer();
        const user = getOptionValue<string>(interaction.data.options, "user") ?? "";
        const unbroken = getOptionValue<boolean>(interaction.data.options, "unbroken") ?? false;

        const type: LeaderboardType = unbroken ? "unbroken" : "any";
        const profileOptions: Options = {
            type,
            isID: false,
        };

        const profile = await getProfile(user, profileOptions);
        if (!profile) {
            await error(
                interaction,
                "User not found. They have no scores in the top 1000 on any level."
            );
            return;
        }

        const paged = new PagedProfileLeaderboard(client, interaction, {
            profile,
            options: { user, profileOptions },
        });
        await paged.start();
    },
});