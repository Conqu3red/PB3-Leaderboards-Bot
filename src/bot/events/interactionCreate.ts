import { CommandInteraction, CommandInteractionOptionResolver } from "discord.js";
import { bot } from "../Index";
import { Event } from "../structures/Event";

export default new Event("interactionCreate", async (interaction) => {
    // Chat Input Commands
    if (interaction.isCommand()) {
        const command = bot.commands.get(interaction.commandName);
        if (!command) return interaction.followUp("You have used a non existent command");

        command.run({
            args: interaction.options as CommandInteractionOptionResolver,
            client: bot,
            interaction: interaction as CommandInteraction,
        });
    }
});
