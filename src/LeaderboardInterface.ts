import { Remote } from "./RemoteLeaderboardInterface";

export interface LevelLeaderboards {
    any: Leaderboard;
    unbroken: Leaderboard;
}

export interface Leaderboard {
    top1000: LeaderboardEntry[];
    top_history: OldestEntry[] | undefined;
    metadata: Remote.LeaderboardMetadata;
}

export interface LeaderboardEntry extends Remote.LeaderboardEntry {
    rank: number;
}

export interface OldestEntry extends LeaderboardEntry {
    time: string;
}

export interface ShortLevelIdentifier {
    world: number;
    level: number;
    isChallenge: boolean;
}

export interface CampaignLevelInfo {
    id: string;
    identifier: ShortLevelIdentifier;
    title: string;
    budget: number;
}

export interface WeeklyLevelInfo {
    id: string;
    title: string;
    week: number;
    payload: string;
    preview: string;
}

export interface LevelBuckets {
    any: LevelBucket[];
    unbreaking: LevelBucket[];
}

export interface LevelBucket {
    startRank: number;
    endRank: number;
    startValue: number;
    endValue: number;
}
