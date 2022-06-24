export namespace Remote {

    export interface LevelLeaderboards {
        any: Leaderboard;
        unbroken: Leaderboard;
    }

    export interface Leaderboard {
        top1000: LeaderboardEntry[];
        metadata: LeaderboardMetadata;
    }

    export interface LeaderboardMetadata {
        uniqueRanksCount: number;
    }

    export interface User {
        id: string;
        display_name: string;
    }

    export interface LeaderboardEntry {
        id: string;
        owner: User;
        value: number;
        didBreak: boolean;
    }

}