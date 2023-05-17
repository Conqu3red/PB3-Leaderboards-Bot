import { asyncSetTimeout } from "./asyncTimeout";

export default class RateLimit {
    frequencyMs: number;
    private start = 0;

    constructor(frequencyMs: number) {
        this.frequencyMs = frequencyMs;
    }

    begin() {
        this.start = Date.now();
    }

    async waitRest() {
        const end = Date.now();
        const delay = this.frequencyMs - (end - this.start);
        if (delay > 0) await asyncSetTimeout(delay);
    }
}
