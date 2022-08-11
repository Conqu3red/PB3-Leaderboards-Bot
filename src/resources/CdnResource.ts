import axios, { ResponseType } from "axios";
import fs from "fs";
import path from "path";
import { CDN_URL, DATA_DIR } from "../Consts";

interface ResourceConfig {
    responseType: ResponseType;
}

export abstract class CdnResource<L, R> {
    reloadIntervalMs: number;
    resourceConfig?: ResourceConfig;
    protected cachedResource: L | null = null;
    protected defaultData: L;

    constructor(reloadIntervalMs: number, defaultData: L, resourceConfig?: ResourceConfig) {
        this.reloadIntervalMs = reloadIntervalMs;
        this.defaultData = defaultData;
        this.resourceConfig = resourceConfig;
    }

    abstract processRemote(old: L, remote: R): Promise<L>;
    abstract localPath(): string;
    abstract remotePath(): string;

    async loadFromRemote(): Promise<R> {
        // TODO: catch exceptions
        let response = await axios.get<R>(this.url(), {
            responseType: this.resourceConfig?.responseType ?? "json",
        });
        let data = response.data;
        return data;
    }

    async reload() {
        let remote = await this.loadFromRemote();
        let old = await this.loadFromFile();
        this.cachedResource = await this.processRemote(old, remote);
        this.save();
        console.log(`Reloaded resource ${this.localPath()}`);
    }

    file() {
        return path.join(DATA_DIR, this.localPath());
    }
    url() {
        return `${CDN_URL}/${this.remotePath()}`;
    }

    async lastReloadTime(): Promise<number> {
        // TODO: catch error if file doesn't exist
        try {
            return (await fs.promises.stat(this.file())).mtimeMs;
        } catch {
            return 0;
        }
    }

    async timeUntilNextReload(): Promise<number> {
        return this.reloadIntervalMs - (Date.now() - (await this.lastReloadTime()));
    }

    async needsReload(): Promise<boolean> {
        return (await this.timeUntilNextReload()) <= 0;
    }

    async loadFromFile(): Promise<L> {
        // TODO: catch error if file doesn't exist
        const filePath = this.file();
        let data: L;
        try {
            data = JSON.parse(await fs.promises.readFile(filePath, "utf8"));
        } catch {
            data = this.defaultData;
        }
        this.cachedResource = data;
        return data;
    }

    async save(): Promise<void> {
        if (this.cachedResource != null) {
            const filePath = this.file();

            await fs.promises.writeFile(filePath, JSON.stringify(this.cachedResource), "utf-8");
        }
    }

    async get(): Promise<L> {
        if (this.cachedResource !== null) {
            return this.cachedResource;
        }
        if (await this.needsReload()) {
            await this.reload();
        }
        return await this.loadFromFile();
    }
}

export class SimpleResource<L, R> extends CdnResource<L, R> {
    local: string;
    remote: string;
    processor: (old: L, remote: R) => Promise<L>;

    constructor(
        reloadIntervalMs: number,
        localPath: string,
        remotePath: string,
        defaultData: L,
        processor: (old: L, remote: R) => Promise<L>,
        resourceConfig?: ResourceConfig
    ) {
        super(reloadIntervalMs, defaultData, resourceConfig);
        this.local = localPath;
        this.remote = remotePath;
        this.processor = processor;
    }

    localPath(): string {
        return this.local;
    }

    remotePath(): string {
        return this.remote;
    }

    processRemote(old: L, remote: R): Promise<L> {
        return this.processor(old, remote);
    }
}
