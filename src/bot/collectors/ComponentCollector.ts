import { BetterClient } from "../structures/Client";
import EventEmitter from "events";
import { ComponentInteraction } from "eris";
import { TypedEmitter } from "tiny-typed-emitter";

interface IOptions {
    time: number;
    filter: (i: ComponentInteraction) => boolean;
    client: BetterClient;
}

interface ComponentCollectorEvents {
    collect: (i: ComponentInteraction) => void;
    end: (interactions: ComponentInteraction[], reason: string) => void;
}
/**
 * Component Collector For The Emerald Package
 */
export class ComponentCollector extends TypedEmitter<ComponentCollectorEvents> {
    options: IOptions;
    ended: boolean;
    collected: ComponentInteraction[];
    listener: (interaction: ComponentInteraction) => Promise<boolean>;
    _timeout: ReturnType<typeof setTimeout> | null = null;

    constructor(options: IOptions) {
        super();

        this.options = options;
        this.ended = false;
        this.collected = [];
        this.listener = (interaction) => this.checkPreConditions(interaction);
        this.options.client.on("interactionCreate", this.listener);

        if (options.time) {
            this._timeout = setTimeout(() => this.stopListening("time"), options.time);
        }
    }

    async checkPreConditions(i: ComponentInteraction) {
        if (this.options.filter(i)) {
            this.emit("collect", i);

            this.collected.push(i);
            return true;
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
