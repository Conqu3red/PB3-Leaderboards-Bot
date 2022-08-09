import { Remote } from "../RemoteLeaderboardInterface";
import { ShortLevelIdentifier, LevelLeaderboards } from "../LeaderboardInterface";

import fs from "fs";
import { CdnResource } from "./CdnResource";

export function tryGetShortLevelIdentifier(short_name: string): ShortLevelIdentifier | null {
    let match = short_name.match(/(\d+)-(\d+)(c?)/i);
    if (match != null) {
        let ident: ShortLevelIdentifier = {
            world: parseInt(match[1]),
            level: parseInt(match[2]),
            isChallenge: match[3].length > 0,
        };

        if (ident.level !== NaN && ident.level !== NaN) return ident;
    }

    return null;
}

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
}
