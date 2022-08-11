import { Remote } from "../RemoteLeaderboardInterface";
import { LevelLeaderboards } from "../LeaderboardInterface";

import fs from "fs";
import { CdnResource } from "./CdnResource";

export abstract class BaseLevel extends CdnResource<LevelLeaderboards, Remote.LevelLeaderboards> {
    constructor(reloadIntervalMs: number) {
        super(reloadIntervalMs, {
            any: {
                top1000: [],
                top_history: undefined,
                metadata: { uniqueRanksCount: 0 },
            },
            unbroken: {
                top1000: [],
                top_history: undefined,
                metadata: { uniqueRanksCount: 0 },
            },
        });
    }

    abstract compactName(): string;
}
