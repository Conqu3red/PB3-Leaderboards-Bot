import { Command } from "../../structures/Command";
import {
    ActionRowBuilder,
    ComponentType,
    InteractionCollector,
    SlashCommandBuilder,
    StringSelectMenuBuilder,
    StringSelectMenuInteraction,
} from "discord.js";
import { parseLevelCode } from "../../../LevelCode";
import { findAllUsersWithUsername } from "../../../UserFinder";
import { cacheManager } from "../../../resources/CacheManager";
import { BaseLevel } from "../../../resources/Level";
import { error } from "../../utils/embeds";
import User from "../../models/User";
import { USER_ID_PATTERN } from "../../utils/pickUserFilter";
import { CampaignLevel } from "../../../resources/CampaignLevel";
import { FormatScore } from "../../../utils/Format";
import SteamUsernames from "../../../resources/SteamUsernameHandler";

async function linkUserWithID(discordID: string, polyBridgeID: string) {
    await User.upsert({ discordID, polyBridgeID });
}

export default new Command({
    command: new SlashCommandBuilder()
        .setName("link")
        .setDescription("Link your discord account with a Poly Bridge 2 user")
        .setDMPermission(false)
        .addStringOption((option) =>
            option
                .setName("user")
                .setDescription("User to link with (begin with @ for a Steam ID)")
                .setRequired(false)
        )
        .addStringOption((option) =>
            option.setName("level").setDescription("Level to scan").setRequired(false)
        )
        .toJSON(),
    run: async ({ interaction, client, args }) => {
        await interaction.deferReply();
        const user = args.getString("user", false);
        const levelCode = args.getString("level", false);

        if (!user) {
            let existingLink = await User.findOne({ where: { discordID: interaction.user.id } });
            if (existingLink) {
                await interaction.editReply(
                    `Currently linked to account with id \`${existingLink.polyBridgeID}\``
                );
            } else {
                await error(interaction, "Account not linked.");
            }
            return;
        }

        const id = user.match(USER_ID_PATTERN);
        if (id) {
            await linkUserWithID(interaction.user.id, id[1]);
            await interaction.editReply({
                content: `Linked to user with ID of \`${id[1]}\``,
                components: [],
            });
            return;
        }

        let levels: CampaignLevel[];

        if (levelCode) {
            const code = parseLevelCode(levelCode);
            if (!code) {
                await error(interaction, "Invalid level code.");
                return;
            }
            const level = await cacheManager.campaignManager.getByCode(code);
            if (!level) {
                await error(interaction, "Level not found.");
                return;
            }

            levels = [level];
        } else {
            levels = cacheManager.campaignManager.campaignLevels;
        }

        const matchingUsers = (await findAllUsersWithUsername(levels, user)).slice(0, 25); // limit of 25

        if (matchingUsers.length === 0) {
            await error(
                interaction,
                "No users found that match the specified username. You must have a score in the top 1000 on a level for the bot to be able to identify you."
            );
        } else {
            const message = await interaction.editReply({
                content: `Found ${matchingUsers.length} users with a matching username.`,
                components: [
                    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
                        new StringSelectMenuBuilder()
                            .setCustomId("user")
                            .setPlaceholder("Select a user")
                            .setOptions(
                                ...matchingUsers.map((user) => {
                                    return {
                                        label: `${SteamUsernames.get(user.steam_id_user)} (ID: ${
                                            user.steam_id_user
                                        })`,
                                        description: `Score on ${user.compactName}${
                                            user.type !== "any" ? ` (${user.type})` : ""
                                        }: #${user.score.rank}, ${FormatScore(
                                            user.score.score,
                                            user.type
                                        )}`,
                                        value: user.steam_id_user,
                                    };
                                })
                            )
                    ),
                ],
            });

            const collector: InteractionCollector<StringSelectMenuInteraction> =
                message.createMessageComponentCollector({
                    componentType: ComponentType.StringSelect,
                    time: 10 * 60 * 1000,
                    max: 1,
                    filter: (i) => {
                        i.deferUpdate();
                        return (
                            i.message.id === message.id && i.message.author.id === message.author.id
                        );
                    },
                });

            collector.on("collect", async (i) => {
                if (i.customId === "user") {
                    //console.log(i.values[0]);
                    await linkUserWithID(i.user.id, i.values[0]);
                    await message.edit({
                        content: `Linked to user with ID of \`${i.values[0]}\``,
                        components: [],
                    });
                }
            });
        }
    },
});
