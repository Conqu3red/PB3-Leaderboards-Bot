import Agent from "agentkeepalive";
import axios from "axios";

export function createHttpAgent() {
    return new Agent({
        maxSockets: 20,
        maxFreeSockets: 20,
        timeout: 60_000,
        freeSocketTimeout: 30_000,
    });
}

export function createHttpsAgent() {
    return new Agent.HttpsAgent({
        maxSockets: 20,
        maxFreeSockets: 20,
        timeout: 60_000,
        freeSocketTimeout: 30_000,
    });
}

export function configureHttp(): void {
    axios.defaults.httpAgent = createHttpAgent();
    axios.defaults.httpsAgent = createHttpsAgent();
}
