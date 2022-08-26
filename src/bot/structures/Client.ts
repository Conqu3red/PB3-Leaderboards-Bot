import Eris, { ApplicationCommand, Client, ClientEvents, Collection } from "eris";
import glob from "glob";
import { promisify } from "util";
import { bot } from "../Index";
import { CommandType } from "../typings/Command";
import { BEvent } from "./Event";
const globPromise = promisify(glob);

export class BetterClient extends Client {
    botToken: string;
    commands: Map<string, CommandType> = new Map();

    constructor(token: string, botOptions: Eris.ClientOptions) {
        const _token = `Bot ${token}`;
        super(_token, botOptions);

        this.botToken = token;
    }

    async start() {
        await this.registerModules();
        await this.connect();
    }

    async importFile(filePath: string) {
        return (await import(filePath)).default;
    }

    async refreshCommands(commands: CommandType[]) {
        // If there are commands in the guild that aren't in the commands array - remove them by name
        const globalCommands = await bot.getCommands();
        const globalCommandNames = globalCommands.map((command) => command.name);
        const commandNames = commands.map((command) => command.name);

        globalCommandNames.forEach(async (commandName) => {
            if (!commandNames.includes(commandName)) {
                await bot.deleteCommand(commandName);
            }
        });

        await bot.bulkEditCommands(commands);
    }

    async registerModules() {
        const slashCommands: CommandType[] = [];
        const commandFiles = await globPromise(`../commands/*/*{.ts,.js}`, {
            cwd: __dirname,
            absolute: true,
        });

        console.log(`Registering commands...`);
        console.log(__dirname);
        console.log(commandFiles);

        commandFiles.forEach(async (filePath) => {
            const command: CommandType = await this.importFile(filePath);
            if (!command.name) return;

            this.commands.set(command.name, command);
            slashCommands.push(command);
            console.log(`✔ "${command.name}" command refreshed successfully.`);
        });

        this.on("ready", () => {
            this.refreshCommands(slashCommands);
        });

        // Event Handler
        const eventFiles = await globPromise(`../events/*{.ts,.js}`, {
            cwd: __dirname,
            absolute: true,
        });
        eventFiles.forEach(async (filePath) => {
            const event: BEvent<keyof ClientEvents> = await this.importFile(filePath);
            this.on(event.event, event.run);
        });
    }
}
