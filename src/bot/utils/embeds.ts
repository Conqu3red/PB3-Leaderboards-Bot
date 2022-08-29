import { CommandInteraction } from "discord.js";

export async function error(interaction: CommandInteraction, reason: string) {
    return await interaction.editReply({
        embeds: [
            {
                title: "An Error Occurred.",
                description: reason,
                color: 0xf93a2f,
            },
        ],
    });
}
