import path from "path";
import axios from "axios";
import { DateTime } from "luxon";
import { Remote } from "./RemoteLeaderboardInterface";
import {
    ShortLevelIdentifier,
    CampaignLevelInfo,
    WeeklyLevelInfo,
    LevelLeaderboards,
    Leaderboard,
    OldestEntry,
    LeaderboardEntry
} from "./LeaderboardInterface";

import {promises as fs} from "fs";
import { CDN_URL, OLDEST_RANK_LIMIT, TIME_FORMAT, DATA_DIR } from "./Consts";

export function tryGetShortLevelIdentifier(short_name: string): ShortLevelIdentifier | null {

    let match = short_name.match(/(\d+)-(\d+)(c?)/i);
    if (match != null) {
        let ident: ShortLevelIdentifier = {
            world: parseInt(match[1]),
            level: parseInt(match[2]),
            isChallenge: match[3].length > 0,
        }

        if (ident.level !== NaN && ident.level !== NaN) return ident;
    }

    return null;
}

function filenameFromCampaignLevelInfo(level: CampaignLevelInfo): string {
    return path.join(DATA_DIR, `${level.id}.json`);
}

async function fetchRemoteLeaderboard(url: string): Promise<Remote.LevelLeaderboards> {
    console.log(`Fetching Leaderboard at "${url}"`);
    let data = (await axios.get(url)).data;
    return data;
}

function processRemoteLeaderboard(leaderboard: Remote.Leaderboard): Leaderboard {
    let result: Leaderboard = {
        top1000: [],
        metadata: leaderboard.metadata,
        top_history: undefined
    }
    
    for (let i = 0; i < leaderboard.top1000.length; i++) {
        let new_entry: LeaderboardEntry = {...leaderboard.top1000[i], rank: i + 1};
        
        if (i > 0 && leaderboard.top1000[i - 1].value == leaderboard.top1000[i].value) {
            new_entry.rank = result.top1000[i - 1].rank; // propagate tied rank
        }

        result.top1000.push(new_entry);
    }

    return result;
}

export function updateOldestDataAndPurgeCheated(oldLeaderboard: Leaderboard, leaderboard: Leaderboard): void {
    let oldHistory = oldLeaderboard.top_history == undefined ? [] : oldLeaderboard.top_history;

    let oldScoreIds: Set<string> = new Set(oldHistory.map(el => el.id));

    let newHistory = [...oldHistory];

    let time = DateTime.now().toFormat(TIME_FORMAT);
    
    // Push scores above `OLDEST_RANK_LIMIT` that aren't already in the history.
    for (let i = 0; i < leaderboard.top1000.length; i++) {
        let entry = leaderboard.top1000[i];
        if (entry.rank > OLDEST_RANK_LIMIT) break;

        if (!oldScoreIds.has(entry.id)) {
            newHistory.push({...entry, time});
        }
    }

    // Identify removed scores
    let cheated_users: Set<string> = new Set();
    
    let new_scores: Map<string, number> = new Map(
        leaderboard.top1000.map(entry => [entry.owner.id, entry.value])
    );

    for (const entry of oldLeaderboard.top1000) {
        const old_score = entry.value;
        const new_score = new_scores.get(entry.owner.id);


        // User has been removed from leaderboard OR their score increased, indicating a score removal
        if (new_score == null || new_score > old_score) {
            console.log(`Detected removed score of $${old_score} by ${entry.owner.display_name} (User ID: ${entry.owner.id})`);
            cheated_users.add(entry.owner.id);
        }
    }
    
    // Only users that haven't had a cheated score
    leaderboard.top_history = newHistory.filter(entry => !cheated_users.has(entry.owner.id));
    console.log(leaderboard.top_history);
}

abstract class Level {
    abstract reload: () => void;
    abstract last_reload: () => Promise<number>;
    abstract needs_reload: () => Promise<boolean>;
    abstract loadLeaderboardFromFile: () => Promise<LevelLeaderboards>;
    abstract file: () => string;
}

export class CampaignLevel implements Level {
    info: CampaignLevelInfo;
    private reloadIntervalMs: number; // TODO: private or not? idk
    private cachedLeaderboard: LevelLeaderboards | null = null;

    static generateCampaignLevelDownload(name: string) {
        return `${CDN_URL}/manifests/leaderboards/scores/${name}.json`
    }

    constructor(info: CampaignLevelInfo, reloadIntervalMs: number) {
        this.info = info;
        this.reloadIntervalMs = reloadIntervalMs;
    }

    async reload() {
        // TODO
        let leaderboards = await fetchRemoteLeaderboard(CampaignLevel.generateCampaignLevelDownload(this.info.id));
        
        this.reload_using(leaderboards);
    }

    async reload_using(leaderboards: Remote.LevelLeaderboards, carryOldest: boolean = true) {
        let current = await this.getLeaderboard();
        
        let processed: LevelLeaderboards = {
            any: processRemoteLeaderboard(leaderboards.any),
            unbroken: processRemoteLeaderboard(leaderboards.unbroken),
        }
        if (carryOldest) {
            updateOldestDataAndPurgeCheated(current.any, processed.any);
            updateOldestDataAndPurgeCheated(current.unbroken, processed.unbroken);
        }

        this.cachedLeaderboard = processed;

        //await this.saveCachedLeaderboard();
    }

    file(): string {
        return filenameFromCampaignLevelInfo(this.info);
    }
    
    async last_reload(): Promise<number> {
        // TODO: catch error if file doesn't exist
        return (await fs.stat(this.file())).mtimeMs;
    }

    async needs_reload(): Promise<boolean> {
        return Date.now() - (await this.last_reload()) > this.reloadIntervalMs;
    }

    async loadLeaderboardFromFile(): Promise<LevelLeaderboards> {
        // TODO: catch error if file doesn't exist
        const filePath = this.file();
        let data: LevelLeaderboards = JSON.parse(await fs.readFile(filePath, "utf8"));
        this.cachedLeaderboard = data;
        return data;
    }

    async saveCachedLeaderboard() {
        if (this.cachedLeaderboard != null) {
            const filePath = this.file();
            await fs.writeFile(filePath, JSON.stringify(this.cachedLeaderboard), "utf-8");
        }
    }

    async getLeaderboard(): Promise<LevelLeaderboards> {
        if (this.cachedLeaderboard != null) {
            return this.cachedLeaderboard
        }
        return this.loadLeaderboardFromFile();
    }

}