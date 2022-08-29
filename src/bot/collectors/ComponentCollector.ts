import { ExtendedClient } from "../structures/Client";
import { TypedEmitter } from "tiny-typed-emitter";
import { ButtonInteraction, Interaction } from "discord.js";

interface IOptions {
    time: number;
    filter: (i: ButtonInteraction) => boolean;
    client: ExtendedClient;
}

interface ComponentCollectorEvents {
    collect: (i: ButtonInteraction) => void;
    end: (interactions: ButtonInteraction[], reason: string) => void;
}
/**
 * Component Collector For The Emerald Package
 */
export class ComponentCollector extends TypedEmitter<ComponentCollectorEvents> {
    options: IOptions;
    ended: boolean;
    collected: ButtonInteraction[];
    listener: (interaction: Interaction) => Promise<void>;
    _timeout: ReturnType<typeof setTimeout> | null = null;

    constructor(options: IOptions) {
        super();

        this.options = options;
        this.ended = false;
        this.collected = [];
        this.listener = async (interaction) => {
            await this.checkPreConditions(interaction);
        };
        this.options.client.on("interactionCreate", this.listener);

        if (options.time) {
            this._timeout = setTimeout(() => this.stopListening("time"), options.time);
        }
    }

    async checkPreConditions(i: Interaction) {
        if (i.isButton()) {
            if (this.options.filter(i)) {
                await i.deferUpdate();
                this.emit("collect", i);

                this.collected.push(i);
                return true;
            }
        }
        return false;
    }

    /**
     * Stops collecting interactions and removes the listener from the client
     */
    stopListening(reason: string) {
        if (this.ended) {
            return;
        }

        this.resetTimer();
        this.ended = true;
        this.options.client.removeListener("interactionCreate", this.listener);
        this.emit("end", this.collected, reason);
    }

    resetTimer() {
        clearTimeout(this._timeout as unknown as number);
        this._timeout = setTimeout(() => this.stopListening("time"), this.options.time);
    }
}
