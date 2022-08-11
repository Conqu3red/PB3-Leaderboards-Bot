import { GlobalEntry, selectLeaderboard } from "./GlobalLeaderboard";
import { LeaderboardType } from "./LeaderboardInterface";
import { LevelCode } from "./LevelCode";
import { Remote } from "./RemoteLeaderboardInterface";
import { LevelBucket } from "./resources/Buckets";
import { cacheManager } from "./resources/CacheManager";
import { CampaignLevelInfo } from "./resources/CampaignIndex";

export interface GlobalPositions {
    all: GlobalEntry;
    regular: GlobalEntry;
    challenge: GlobalEntry;
    // TODO: weekly
}

export interface ScoreCount {
    overall: number;
    regular: number;
    challenge: number;
    weekly: number;
}

export interface ScoreCounts {
    top1: ScoreCount;
    top10: ScoreCount;
    top100: ScoreCount;
    top1000: ScoreCount;
}

export interface LevelScore {
    compactName: string;
    score: Remote.LeaderboardEntry | undefined;
}

export interface Stats {
    globalPositions: GlobalPositions;
    scoreCounts: ScoreCounts;
    levelScores: LevelScore[];
}

export interface Profile {
    user: Remote.User;
    stats: Stats;
}

export interface Options {
    isID: boolean;
    type: LeaderboardType;
}

export async function getProfile(user: string, options?: Options) {
    options = options ?? { isID: false, type: "any" };
    let owner: Remote.User | undefined = undefined;

    let levelScores: LevelScore[] = [];

    await cacheManager.campaignManager.maybeReload();
    await cacheManager.weeklyManager.maybeReload();

    for (const level of [
        ...cacheManager.campaignManager.campaignLevels,
        ...cacheManager.weeklyManager.weeklyLevels,
    ]) {
        let boards = await level.get();
        let board = selectLeaderboard(boards, options.type);

        let entry: Remote.LeaderboardEntry | undefined = undefined;
        for (const score of board.top1000) {
            if (
                !owner &&
                (options.isID ? score.owner.id === user : score.owner.display_name === user)
            ) {
                owner = score.owner;
            }
            if (score.owner.id === owner?.id) {
                entry = score;
                break;
            }
        }

        levelScores.push({ compactName: level.compactName(), score: entry });
    }

    // TODO: get users scores from every level
    // TODO: score counts and global positions
}
