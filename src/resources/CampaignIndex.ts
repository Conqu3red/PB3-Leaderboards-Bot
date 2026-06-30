import { LevelCode, parseLevelCode } from "../LevelCode";
import campaignLevels from "../../json/campaign_levels.json";
import pb2CampaignLevels from "../../json/pb2_campaign_levels.json";

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
    pb2: boolean;
}

export async function loadCampaignLevelInfos(): Promise<CampaignLevelInfo[]> {
    let data: StoredCampaignLevelInfo[] = pb2CampaignLevels.concat(campaignLevels);

    const defaultCode: LevelCode = {world: "CR", level: -1, challenge: false}

    let pb2 = pb2CampaignLevels.map(info => ({...info, pb2: true, code: parseLevelCode(info.code) ?? defaultCode}));
    let pb3 = campaignLevels.map(info => ({...info, pb2: false, code: parseLevelCode(info.code) ?? defaultCode}));
    return pb2.concat(pb3)
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
