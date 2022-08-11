import { LevelCode, parseLevelCode } from "../LevelCode";
import campaignLevels from "../../json/campaign_levels.json";

interface StoredCampaignLevelInfo {
    id: string;
    code: string;
    name: string;
    budget: number;
}

export interface CampaignLevelInfo {
    id: string;
    code: LevelCode;
    name: string;
    budget: number;
}

export async function loadCampaignLevelInfos(): Promise<CampaignLevelInfo[]> {
    let data: StoredCampaignLevelInfo[] = campaignLevels;

    return data.map((info) => {
        return {
            id: info.id,
            code: parseLevelCode(info.code) ?? { world: 0, level: 0, isChallenge: false },
            name: info.name,
            budget: info.budget,
        };
    });
}

/*
Alternative impl?
export function tryGetShortLevelIdentifier(short_name: string): ShortLevelIdentifier | null {
    let match = short_name.match(/(\d+)-(\d+)(c?)/i);
    if (match != null) {
        let ident: ShortLevelIdentifier = {
            world: parseInt(match[1]),
            level: parseInt(match[2]),
            isChallenge: match[3].length > 0,
        };

        if (!isNan(ident.world) && !isNan(ident.level)) return ident;
    }

    return null;
}

*/
