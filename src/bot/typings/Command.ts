import {
    CommandInteraction,
    CommandInteractionOptionResolver,
    PermissionResolvable,
    RESTPostAPIApplicationCommandsJSONBody,
} from "discord.js";
import { ExtendedClient } from "../structures/Client";

interface RunOptions {
    client: ExtendedClient;
    interaction: CommandInteraction;
    args: CommandInteractionOptionResolver;
}

type RunFunction = (options: RunOptions) => any;

export type CommandType = {
    userPermissions?: PermissionResolvable[];
    run: RunFunction;
} & RESTPostAPIApplicationCommandsJSONBody;
