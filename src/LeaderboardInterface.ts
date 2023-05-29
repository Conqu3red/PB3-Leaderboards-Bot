/* export interface LevelLeaderboards {
    any: Leaderboard;
    unbroken: Leaderboard;
} */

export interface Leaderboard {
    top1000: LeaderboardEntry[];
    leaderboard_entry_count: number;
}

/* export interface Leaderboard {
    top1000: LeaderboardEntry[];
    top_history: OldestEntry[] | undefined;
    metadata: Remote.LeaderboardMetadata;
} */

export interface LeaderboardEntry {
    steam_id_user: string;
    score: number;
    rank: number;
    didBreak: boolean;
}

export interface OldestEntry extends LeaderboardEntry {
    time: number; // epoch seconds
    cheated: boolean;
}

export interface WeeklyLevelInfo {
    id: string;
    title: string;
    week: number;
    payload: string;
    preview: string;
}

export type LeaderboardType = "any" | "unbreaking" | "stress";
