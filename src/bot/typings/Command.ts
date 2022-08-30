import {
    ApplicationCommandData,
    CommandInteraction,
    CommandInteractionOptionResolver,
    PermissionResolvable,
} from "discord.js";
import { ExtendedClient } from "../structures/Client";

interface RunOptions {
    client: ExtendedClient;
    interaction: CommandInteraction;
    args: CommandInteractionOptionResolver;
}

type RunFunction = (options: RunOptions) => any;

export type CommandType = {
    command: ApplicationCommandData;
    run: RunFunction;
};
