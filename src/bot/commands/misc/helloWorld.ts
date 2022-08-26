import Eris from "eris";
import { BCommand } from "../../structures/Command";

export default new BCommand({
    name: "hello",
    description: "hello world",
    type: Eris.Constants.ApplicationCommandTypes.CHAT_INPUT,
    run: async ({ interaction }) => {
        interaction.createMessage("Hello");
    },
});
