import { promises as fs } from "fs";
import {
    CampaignLevelInfo,
    Leaderboard,
    LeaderboardEntry,
    LevelLeaderboards,
    OldestEntry,
} from "../src/LeaderboardInterface";
import { updateOldestDataAndPurgeCheated } from "../src/LeaderboardProcessors";
import { CampaignLevel } from "../src/resources/CampaignLevel";
import { Remote } from "../src/RemoteLeaderboardInterface";
import assert from "assert";

function getTestLevel(): CampaignLevel {
    let levelInfo: CampaignLevelInfo = {
        id: "mAp2V",
        identifier: { world: 1, level: 1, isChallenge: false },
        name: "Ten Meter Simple Bridge",
        budget: 10_000,
    };

    return new CampaignLevel(levelInfo, 8 * 60 * 60 * 60 * 1000);
}

function board(
    scores: LeaderboardEntry[],
    oldest: OldestEntry[] | undefined = undefined
): Leaderboard {
    return {
        top1000: scores,
        top_history: oldest,
        metadata: { uniqueRanksCount: scores.length },
    };
}

function getAnyOldest(leaderboards: LevelLeaderboards): OldestEntry[] {
    return leaderboards.any.top_history ?? [];
}

export async function oldestShouldHaveIds(
    actual: OldestEntry[] | undefined,
    recieved: LeaderboardEntry[]
) {
    assert.notEqual(actual, undefined);

    if (actual != undefined) {
        assert.equal(actual.length, recieved.length);

        for (let i = 0; i < actual.length; i++) {
            assert.equal(actual[i].id, recieved[i].id); // same score ID
        }
    }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("Oldest Processing", () => {
    it("One score", async () => {
        // 100
        let owner: Remote.User = { id: "o1", display_name: "owner1" };

        let score1: LeaderboardEntry = {
            rank: 1,
            id: "1",
            value: 100,
            didBreak: false,
            owner,
        };

        let board1 = board([]);
        let board2 = board([score1]);
        updateOldestDataAndPurgeCheated(board1, board2);
        oldestShouldHaveIds(board2.top_history, [score1]);
    });

    it("Score overtaking", async () => {
        // 100 -> 90
        let owner: Remote.User = { id: "o1", display_name: "owner1" };

        let score1: LeaderboardEntry = {
            rank: 1,
            id: "1",
            value: 100,
            didBreak: false,
            owner,
        };
        let score2: LeaderboardEntry = {
            rank: 1,
            id: "2",
            value: 90,
            didBreak: false,
            owner,
        };

        let board1 = board([score1]);
        let board2 = board([score2]);
        updateOldestDataAndPurgeCheated(board1, board2);

        oldestShouldHaveIds(board2.top_history, [score1, score2]);
    });
});

describe("Removed score detection", () => {
    it("Increased user score should indicate a removed score", async () => {
        // 100 -> 110
        let owner: Remote.User = { id: "o1", display_name: "owner1" };

        let score1: LeaderboardEntry = {
            rank: 1,
            id: "1",
            value: 100,
            didBreak: false,
            owner,
        };
        let score2: LeaderboardEntry = {
            rank: 1,
            id: "2",
            value: 110,
            didBreak: false,
            owner,
        };

        let board1 = board([]);
        let board2 = board([score1]);
        updateOldestDataAndPurgeCheated(board1, board2);
        oldestShouldHaveIds(board2.top_history, [score1]);

        let board3 = board([score2]);
        updateOldestDataAndPurgeCheated(board2, board3);
        oldestShouldHaveIds(board3.top_history, []);
    });

    it("no user score on update should indicate a removed score", async () => {
        // 100 -> 0
        let owner: Remote.User = { id: "o1", display_name: "owner1" };

        let score1: LeaderboardEntry = {
            rank: 1,
            id: "1",
            value: 100,
            didBreak: false,
            owner,
        };

        let board1 = board([score1]);
        let board2 = board([]);
        updateOldestDataAndPurgeCheated(board1, board2);
        oldestShouldHaveIds(board2.top_history, []);
    });
});

/* (async () => {
    let a: LevelLeaderboards = JSON.parse(await fs.readFile("data/mAp2V.json", "utf-8"));

    console.log(a.any.metadata.uniqueRanksCount);

    let level = getTestLevel();

    console.log("Blank LB:")

    await level.reload_using({
        any: {top1000: [], metadata: {uniqueRanksCount: 1}},
        unbroken: {top1000: [], metadata: {uniqueRanksCount: 1}}
    }, false);

    console.log("1st LB:")
    
    await level.reload_using({
        any: {top1000: [
            {
                id: "1",
                value: 100,
                didBreak: false,
                owner: {id: "o1", display_name: "owner1"},
            }
        ], metadata: {uniqueRanksCount: 1}},
        unbroken: {top1000: [], metadata: {uniqueRanksCount: 1}}
    });

    await sleep(1000);

    console.log("2nd LB (score increased):")
    
    await level.reload_using({
        any: {top1000: [
            {
                id: "2",
                value: 110,
                didBreak: false,
                owner: {id: "o1", display_name: "owner1"},
            }
        ], metadata: {uniqueRanksCount: 1}},
        unbroken: {top1000: [], metadata: {uniqueRanksCount: 1}}
    });

    await sleep(1000);

    console.log("3rd LB (score gone):")
    
    await level.reload_using({
        any: {top1000: [], metadata: {uniqueRanksCount: 0}},
        unbroken: {top1000: [], metadata: {uniqueRanksCount: 0}}
    });
    
    let data = await level.getLeaderboard();

    console.log(data.any.metadata.uniqueRanksCount);
    console.log(data.any.top1000[0]);
})(); */
