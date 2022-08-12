import {
    findUser,
    GlobalEntry,
    globalLeaderboard,
    GlobalScoreByRank,
    selectLeaderboard,
} from "./GlobalLeaderboard";
import { LeaderboardType } from "./LeaderboardInterface";
import { LevelCode } from "./LevelCode";
import { Remote } from "./RemoteLeaderboardInterface";
import { LevelBucket } from "./resources/Buckets";
import { cacheManager } from "./resources/CacheManager";
import { CampaignLevelInfo } from "./resources/CampaignIndex";
import { CampaignLevel } from "./resources/CampaignLevel";
import { BaseLevel } from "./resources/Level";

export interface GlobalPositions {
    all: GlobalEntry | null;
    regular: GlobalEntry | null;
    challenge: GlobalEntry | null;
    weekly: GlobalEntry | null;
}

export interface ScoreCount {
    overall: number;
    regular: number;
    challenge: number;
    weekly: number;
}

export interface ScoreCounts {
    [key: number]: ScoreCount;
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

function isCampgainLevel(level: BaseLevel<any>): level is CampaignLevel {
    return (level as CampaignLevel).info.code !== undefined;
}

export async function getProfile(user: string, options?: Options): Promise<Profile | null> {
    options = options ?? { isID: false, type: "any" };
    let owner: Remote.User | undefined = undefined;

    let levelScores: LevelScore[] = [];
    const countThresholds = [1, 10, 100, 1000].sort((a, b) => a - b); // low to high

    let scoreCounts: ScoreCounts = Object.fromEntries(
        countThresholds.map((value) => [value, { overall: 0, regular: 0, challenge: 0, weekly: 0 }])
    );

    await cacheManager.campaignManager.maybeReload();
    await cacheManager.weeklyManager.maybeReload();

    const levels = [
        ...cacheManager.campaignManager.campaignLevels,
        ...cacheManager.weeklyManager.weeklyLevels,
    ];

    for (const level of levels) {
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

                // Threshold processing
                for (const threshold of countThresholds) {
                    if (score.rank <= threshold) {
                        scoreCounts[threshold].overall += 1;
                        if (isCampgainLevel(level)) {
                            if (level.info.code.isChallenge) scoreCounts[threshold].challenge += 1;
                            else scoreCounts[threshold].regular += 1;
                        } else {
                            scoreCounts[threshold].weekly += 1;
                        }
                    }
                }

                break;
            }
        }

        levelScores.push({ compactName: level.compactName(), score: entry });
    }

    if (!owner) return null;

    const globalPositions: GlobalPositions = {
        all: findUser(
            (await globalLeaderboard({
                levelCategory: "all",
                type: options.type,
                scoreComputer: GlobalScoreByRank,
            })) ?? [],
            owner?.id
        ),
        regular: findUser(
            (await globalLeaderboard({
                levelCategory: "regular",
                type: options.type,
                scoreComputer: GlobalScoreByRank,
            })) ?? [],
            owner?.id ?? ""
        ),
        challenge: findUser(
            (await globalLeaderboard({
                levelCategory: "challenge",
                type: options.type,
                scoreComputer: GlobalScoreByRank,
            })) ?? [],
            owner?.id
        ),
        weekly: findUser(
            (await globalLeaderboard({
                levelCategory: "weekly",
                type: options.type,
                scoreComputer: GlobalScoreByRank,
            })) ?? [],
            owner?.id
        ),
    };

    return {
        user: owner,
        stats: {
            globalPositions,
            levelScores,
            scoreCounts,
        },
    };

    // TODO: get users scores from every level
    // TODO: score counts and global positions
}
