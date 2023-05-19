import {
    ApplicationCommandDataResolvable,
    Client,
    ClientEvents,
    Collection,
    GatewayIntentBits,
    SlashCommandBuilder,
} from "discord.js";
import { CommandType } from "../typings/Command";
import glob from "glob";
import { promisify } from "util";
import { Event } from "./Event";

const globPromise = promisify(glob);

export class ExtendedClient extends Client {
    _token: string;
    commands: Collection<string, CommandType> = new Collection();

    constructor(token: string, intents: GatewayIntentBits[]) {
        super({ intents: intents });
        this._token = `Bot ${token}`;
    }

    async start() {
        await this.registerModules();
        await this.login(this._token);
    }

    async importFile(filePath: string) {
        return (await import(filePath)).default;
    }

    async registerCommands(commands: ApplicationCommandDataResolvable[]) {
        this.application?.commands.set(commands);
        console.log("Registering global commands");
    }

    async registerModules() {
        // Command Handler
        const slashCommands: ApplicationCommandDataResolvable[] = [];
        const commandFiles = await globPromise(`../commands/*/*{.ts,.js}`, {
            cwd: __dirname,
            absolute: true,
        });
        commandFiles.forEach(async (filePath) => {
            const command: CommandType = await this.importFile(filePath);
            if (!command?.command?.name) {
                console.log("ERROR: unable to load command:", filePath);
                return;
            }
            console.log(`Command: "${command.command.name}" found.`);
            this.commands.set(command.command.name, command);
            slashCommands.push(command.command);
        });

        this.on("ready", () => {
            this.registerCommands(slashCommands);
        });

        // Event Handler
        const eventFiles = await globPromise(`../events/*{.ts,.js}`, {
            cwd: __dirname,
            absolute: true,
        });
        eventFiles.forEach(async (filePath) => {
            const event: Event<keyof ClientEvents> = await this.importFile(filePath);
            this.on(event.event, event.run);
        });
    }
}
