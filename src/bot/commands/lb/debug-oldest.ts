import { cacheManager } from "../../../resources/CacheManager";
import { Command } from "../../structures/Command";
import { error } from "../../utils/embeds";
import { AttachmentBuilder, SlashCommandBuilder } from "discord.js";
import { parseLevelCode } from "../../../LevelCode";

export default new Command({
    command: new SlashCommandBuilder()
        .setName("debug-oldest")
        .setDescription(`Get debug oldest data`)
        .setDMPermission(true)
        .setDefaultMemberPermissions("0")
        .addStringOption((option) =>
            option.setName("level").setDescription("level").setRequired(true)
        )
        .toJSON(),
    run: async ({ interaction, client, args }) => {
        await interaction.deferReply();
        const levelCode = parseLevelCode(args.getString("level", true));

        if (!levelCode) {
            await error(interaction, "Invalid level code.");
            return;
        }

        const level = await cacheManager.campaignManager.getByCode(levelCode);
        if (!level) {
            await error(interaction, "Unknown level.");
            return;
        }

        const attachment = new AttachmentBuilder(
            Buffer.from(
                JSON.stringify({
                    any: { top_history: level.getHistory(false) },
                    unbroken: { top_history: level.getHistory(true) },
                })
            )
        ).setName(`${level.compactName()}.json`);

        await interaction.editReply({ files: [attachment] });
    },
});
