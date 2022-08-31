import { Command } from "../../structures/Command";
import {
    ActionRowBuilder,
    ComponentType,
    InteractionCollector,
    SelectMenuBuilder,
    SelectMenuInteraction,
    SlashCommandBuilder,
} from "discord.js";
import { parseLevelCode } from "../../../LevelCode";
import { findAllUsersWithUsername } from "../../../UserFinder";
import { cacheManager } from "../../../resources/CacheManager";
import { BaseLevel } from "../../../resources/Level";
import { error } from "../../utils/embeds";
import User from "../../models/User";
import { USER_ID_PATTERN } from "../../utils/pickUserFilter";

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
                .setDescription("User to link with (begin with @) for an ID")
                .setRequired(false)
        )
        .addStringOption((option) =>
            option.setName("level").setDescription("Level to scan").setRequired(false)
        )
        .addStringOption((option) =>
            option.setName("week").setDescription("Weekly level to scan").setRequired(false)
        )
        .toJSON(),
    run: async ({ interaction, client, args }) => {
        await interaction.deferReply();
        const user = args.getString("user", false);
        const levelCode = args.getString("level", false);
        const week = args.getInteger("week", false);

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
            await linkUserWithID(interaction.user.id, id[0]);
            await interaction.editReply({
                content: `Linked to user with ID of \`${id[0]}\``,
                components: [],
            });
            return;
        }

        let levels: BaseLevel<any>[];

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
        } else if (week) {
            const level = await cacheManager.weeklyManager.getByWeek(week);
            if (!level) {
                await error(interaction, "Level not found.");
                return;
            }
            levels = [level];
        } else {
            levels = cacheManager.campaignManager.campaignLevels.concat(
                cacheManager.weeklyManager.weeklyLevels as BaseLevel<any>[]
            );
        }

        const matchingUsers = (await findAllUsersWithUsername(levels, user)).slice(0, 25); // limit of 25

        if (matchingUsers.length === 0) {
            await error(interaction, "No users found that match the specified username");
        } else {
            const message = await interaction.editReply({
                content: "Select a user:",
                components: [
                    new ActionRowBuilder<SelectMenuBuilder>().addComponents(
                        new SelectMenuBuilder()
                            .setCustomId("user")
                            .setPlaceholder("Select a user")
                            .setOptions(
                                ...matchingUsers.map((user) => {
                                    return {
                                        label: `${user.user.display_name} (ID: ${user.user.id})`,
                                        description: `Score on ${user.score.compactName}: #${
                                            user.score.score.rank
                                        }, $${user.score.score.value.toLocaleString("en-US")}`,
                                        value: user.user.id,
                                    };
                                })
                            )
                    ),
                ],
            });

            const collector: InteractionCollector<SelectMenuInteraction> =
                message.createMessageComponentCollector({
                    componentType: ComponentType.SelectMenu,
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
                    console.log(i.values[0]);
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
