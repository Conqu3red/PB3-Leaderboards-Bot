import Eris from "eris";

export async function error(interaction: Eris.CommandInteraction, reason: string) {
    return await interaction.editOriginalMessage({
        embeds: [
            {
                title: "An Error Occurred.",
                description: reason,
                color: 0xf93a2f,
            },
        ],
    });
}
