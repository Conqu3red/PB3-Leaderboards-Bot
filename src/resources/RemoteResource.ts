import axios, { AxiosError, ResponseType } from "axios";
import fs from "fs";
import path from "path";
import { CDN_URL, DATA_DIR } from "../Consts";

interface ResourceConfig {
    responseType: ResponseType;
}

export abstract class RemoteResource<RemoteType> {
    reloadIntervalMs: number;
    resourceConfig: ResourceConfig;
    lastReloadTimeMs: number;

    constructor(
        reloadIntervalMs: number,
        resourceConfig: ResourceConfig = { responseType: "json" }
    ) {
        this.reloadIntervalMs = reloadIntervalMs;
        this.resourceConfig = resourceConfig;
        this.lastReloadTimeMs = 0;
    }

    url(): string {
        return `${CDN_URL}/${this.remotePath()}`;
    }

    async loadFromRemote(): Promise<RemoteType> {
        // TODO: catch exceptions
        let response = await axios.get<RemoteType>(this.url(), {
            responseType: this.resourceConfig.responseType,
        });
        return response.data;
    }

    async reload() {
        let remote: RemoteType;
        try {
            remote = await this.loadFromRemote();
        } catch (e) {
            if (axios.isAxiosError(e)) {
                console.error(
                    `Axios error while trying to reload ${this.remotePath()}: `,
                    e.toJSON()
                );
            } else {
                console.error(`Error while trying to reload ${this.remotePath()}:`, e);
            }
            return;
        }
        this.lastReloadTimeMs = Date.now();
        await this.process(remote);
        console.log(`Reloaded resource ${this.remotePath()}`);
    }

    timeUntilNextReload(): number {
        return this.reloadIntervalMs - (Date.now() - this.lastReloadTimeMs);
    }

    needsReload(): boolean {
        return this.timeUntilNextReload() <= 0;
    }

    abstract remotePath(): string;
    abstract process(data: RemoteType): Promise<void>;
}

export class SimpleResource<L, R> extends RemoteResource<R> {
    protected cachedResource: L | null = null;
    protected defaultData: L;
    local: string;
    remote: string;
    processor: (remote: R) => Promise<L>;

    constructor(
        reloadIntervalMs: number,
        localPath: string,
        remotePath: string,
        defaultData: L,
        processor: (remote: R) => Promise<L>,
        resourceConfig?: ResourceConfig
    ) {
        super(reloadIntervalMs, resourceConfig);
        this.defaultData = defaultData;
        this.local = localPath;
        this.remote = remotePath;
        this.processor = processor;
    }

    async process(data: R): Promise<void> {
        this.cachedResource = await this.processor(data);
        this.save();
    }

    file() {
        return path.join(DATA_DIR, this.local);
    }

    async loadFromFile(): Promise<L> {
        // TODO: catch error if file doesn't exist
        const filePath = this.file();
        let data: L;
        try {
            data = JSON.parse(await fs.promises.readFile(filePath, "utf8"));
        } catch {
            // This is a fatal error.
            console.error(`FATAL: failed to load ${this.remotePath()}`);
            data = this.defaultData;
        }
        this.cachedResource = data;
        return data;
    }

    async save(): Promise<void> {
        if (this.cachedResource) {
            const filePath = this.file();

            await fs.promises.writeFile(filePath, JSON.stringify(this.cachedResource), "utf-8");
        }
    }

    async get(): Promise<L> {
        if (this.cachedResource) {
            return this.cachedResource;
        }
        if (this.needsReload()) {
            await this.reload();
        }
        return await this.loadFromFile();
    }

    remotePath(): string {
        return this.remote;
    }
}
