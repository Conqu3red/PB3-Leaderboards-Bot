import Eris, { CommandInteraction } from "eris";
import { bot } from "../Index";
import { BEvent } from "../structures/Event";

export default new BEvent("interactionCreate", async (interaction) => {
    // Chat Input Commands
    if (interaction instanceof Eris.CommandInteraction) {
        const command = bot.commands.get(interaction.data.name);

        if (!command) return interaction.createFollowup("This command does not exist!");

        return command.run({
            interaction,
            client: bot,
        });
    }

    if (interaction instanceof Eris.ComponentInteraction) {
        interaction.deferUpdate(); // To stop nonsense update messages
    }
});
