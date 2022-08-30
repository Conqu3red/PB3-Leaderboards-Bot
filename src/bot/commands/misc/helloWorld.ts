import { SlashCommandBuilder } from "discord.js";
import { Command } from "../../structures/Command";
new SlashCommandBuilder().name
export default new Command({
    command: new SlashCommandBuilder().setName("hello").setDescription("hello world").toJSON(),
    run: async ({ interaction }) => {
        interaction.reply("Hello");
    },
});
