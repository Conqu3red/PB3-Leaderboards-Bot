import { Command } from "../../structures/Command";

export default new Command({
    name: "hello",
    description: "hello world",
    run: async ({ interaction }) => {
        interaction.reply("Hello");
    },
});
