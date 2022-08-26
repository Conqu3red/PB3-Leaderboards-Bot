import Eris from "eris";
import { BCommand } from "../../structures/Command";

function tryGetOption(
    options: Eris.InteractionDataOptions[] | undefined,
    name: string
): Eris.InteractionDataOptions | undefined {
    return options?.find((o) => o.name == name);
}

function getOptionValue<T>(
    options: Eris.InteractionDataOptions[] | undefined,
    name: string
): T | undefined {
    return tryGetOption(options, name)?.value as T | undefined;
}

export default new BCommand({
    name: "leaderboard",
    description: "Shows the leaderboard for a campaign level",
    type: Eris.Constants.ApplicationCommandTypes.CHAT_INPUT,
    dmPermission: false,
    options: [
        {
            name: "level",
            description: "Level identifier to display leaderboard for",
            type: Eris.Constants.ApplicationCommandOptionTypes.STRING,
            required: true,
        },
        {
            name: "unbroken",
            description: "Show leaderboard for scores that didn't break",
            type: Eris.Constants.ApplicationCommandOptionTypes.BOOLEAN,
            required: false,
        },
        {
            name: "user",
            description: "User to find on the leaderboard",
            type: Eris.Constants.ApplicationCommandOptionTypes.STRING,
            required: false,
        },
    ],
    run: async ({ interaction }) => {
        const levelCode = getOptionValue(interaction.data.options, "level");
        if (!levelCode) {
            await interaction.createFollowup("No level code specified");
            return;
        }
        const unbroken = getOptionValue(interaction.data.options, "unbroken") ?? false;
        const user = getOptionValue(interaction.data.options, "user");
        console.log(levelCode, unbroken, user);
        //interaction.createMessage("leaderboard");
    },
});
