import { cacheManager } from "./resources/CacheManager";
import { campaignBuckets } from "./resources/Buckets";
import { configureHttp } from "./resources/ConfigureHttpAgents";
import { globalLeaderboard } from "./GlobalLeaderboard";
import { getProfile } from "./Profile";
import { sumOfBest } from "./SumOfBest";
import { getOldest, getTopUserStreaks, groupBy } from "./Oldest";
import { DateTime } from "luxon";
import { findAllUsersWithUsername } from "./UserFinder";
import { getPercentile } from "./Milestones";
import { renderHistogram, collectBuckets, getHistogramBuckets } from "./ScoreDistribution";
import { database, userDB } from "./resources/Lmdb";
import fs from "fs";
import SteamUsernames from "./resources/SteamUsernameHandler";
import { encodeLevelCode } from "./LevelCode";

async function otherStuff() {
    let level = await cacheManager.campaignManager.getByCode("CR-01");
    console.log(level);

    await campaignBuckets.reload();
    let buckets = await campaignBuckets.get();
    let levelBuckets = buckets["001"];
    if (levelBuckets) {
        console.log(levelBuckets.any);
    }

    console.time("globalBoard");
    let globalBoard = await globalLeaderboard({
        type: "any",
        levelCategory: "all",
        scoringMode: "rank",
    });
    console.timeEnd("globalBoard");

    console.time("globalBoard");
    globalBoard = await globalLeaderboard({
        type: "any",
        levelCategory: "all",
        scoringMode: "score",
    });
    console.timeEnd("globalBoard");

    if (globalBoard) {
        console.log(`Global board, length: ${globalBoard.length}`);
        console.log(globalBoard[0]);
        console.log(globalBoard[1]);
    }

    console.time("profile");
    let myProfile = await getProfile({ by: "display_name", value: "Conqu3red" });
    console.timeEnd("profile");
    console.log(myProfile);
    if (myProfile) {
        console.log(myProfile.stats.globalPositions);
        console.log(myProfile.stats.scoreCounts[1]);
    }

    console.time("sumsOfBest");
    let sumsOfBest = await sumOfBest("any");
    console.timeEnd("sumsOfBest");
    console.log(sumsOfBest);

    console.log(groupBy([1, 1, 2, 3, 3], (obj) => obj));
}

async function buckets() {
    let level = await cacheManager.campaignManager.getByCode("1-1");
    await campaignBuckets.reload();
    const buckets = await campaignBuckets.get();

    let most: string = "";
    let max = 0;
    for (const l of cacheManager.campaignManager.campaignLevels) {
        const b = buckets[l.info.id];
        if (b) {
            let p = b.any.end[b.any.end.length - 1];
            if (p > max) {
                max = p;
                most = l.compactName();
            }
        }
    }
    console.log(`${most}: $${max.toLocaleString("en-US")}`);
}

async function main() {
    configureHttp();

    await cacheManager.campaignManager.populate();

    // await weeklyTest();
    await otherStuff();

    //await Promise.all(cacheManager.campaignManager.campaignLevels.map((l) => l.reload()));

    let level = await cacheManager.campaignManager.getByCode("1-1");

    if (level) {
        console.log("OLDEST 1-1");
        const history = level.getHistory("any");
        for (const entry of history) {
            if (entry.cheated) {
                console.log(
                    `   ---- CHEATED ${DateTime.fromSeconds(entry.time).toISODate()} #${
                        entry.rank
                    } $${entry.score} ${SteamUsernames.get(entry.steam_id_user)}`
                );
            } else {
                console.log(
                    `    ${DateTime.fromSeconds(entry.time).toISODate()} #${entry.rank} $${
                        entry.score
                    } ${SteamUsernames.get(entry.steam_id_user)}`
                );
            }
        }

        console.time("oldest");
        let t = getTopUserStreaks(level.getHistory("any"));
        console.timeEnd("oldest");
        if (t) {
            console.log(t.length);
            let now = DateTime.now();
            for (const user of t) {
                console.log(
                    `${Math.floor(
                        now.diff(DateTime.fromSeconds(user.initialTime)).as("days")
                    )}d ago: $${user.latestScore.score} (${SteamUsernames.get(
                        user.latestScore.steam_id_user
                    )})`
                );
            }
        } else {
            console.log("no results");
        }

        //renderBoard({ board }, 0);
    }

    console.time("full oldest");
    let oldestResults = await getOldest("any", {});
    console.timeEnd("full oldest");
    console.log(oldestResults.length);
    let now = DateTime.now();
    for (const user of oldestResults) {
        console.log(
            `${Math.floor(now.diff(DateTime.fromSeconds(user.initialTime)).as("days"))}d ago: $${
                user.latestScore.score
            } (${SteamUsernames.get(user.latestScore.steam_id_user)})`
        );
        break;
    }

    /* console.log(
        "Users with name:",
        await findAllUsersWithUsername(cacheManager.campaignManager.campaignLevels, "alex")
    ); */

    let buckets = await campaignBuckets.get();
    let level2 = await cacheManager.campaignManager.getByCode("CR-01");
    if (level2) {
        let bucket = buckets[level2.info.id];
        const split = await getHistogramBuckets(level2, "any");
        if (split && bucket) {
            const buf = renderHistogram(split, {
                levelBudget: level2.info.budget,
                userScore: 26000,
                userPercentile: getPercentile(26000, bucket.any),
                type: "any",
            });
            fs.writeFileSync(`./test.png`, buf);
        }
    }

    /* for (const level of cacheManager.campaignManager.campaignLevels) {
        let levelBuckets = buckets[level.info.id];
        const histogram_buckets = await getHistogramBuckets(level, "any");
        if (levelBuckets && histogram_buckets) {
            const buf = renderHistogram(histogram_buckets, {
                levelBudget: level.info.budget,
                type: "any",
            });
            fs.writeFileSync(`./distributions/${encodeLevelCode(level.info.code)}.png`, buf);
            console.log(`-> ./distributions/${encodeLevelCode(level.info.code)}.png`);
        }
    } */

    //await buckets();

    /* let userMap: Map<string, Remote.User> = new Map();
    let plusOneCounts: Map<string, number> = new Map();

    console.log("Checking...");
    for (const level of cacheManager.campaignManager.campaignLevels) {
        let board = (await level.get()).any.top1000;
        let prevRankScore = -1;
        let prevRank = -1;
        for (let score of board) {
            if (score.rank > 100) break;
            if (score.value === prevRankScore + 1) {
                plusOneCounts.set(score.owner.id, (plusOneCounts.get(score.owner.id) ?? 0) + 1);
                userMap.set(score.owner.id, score.owner);
            }
            if (score.rank !== prevRank) {
                prevRankScore = score.value;
                prevRank = score.rank;
            }
        }
    }
    plusOneCounts = new Map([...plusOneCounts.entries()].sort((a, b) => b[1] - a[1]));

    for (const [uid, count] of plusOneCounts) {
        const user = userMap.get(uid);
        if (!user) continue;
        console.log(`${count}: ${user.display_name} (${user.id})`);
    } */

    /* let p = await getProfile({ by: "display_name", value: "tests" });
    if (p) {
        for (const score of p.stats.levelScores) {
            if (score.score) {
                let level = await cacheManager.campaignManager.getByCode(score.compactName);
                if (level) {
                    let board = (await level.get()).any.top1000;
                    for (let i = 0; i < board.length; i++) {
                        if (board[i].owner.id === score.score.owner.id) {
                            //console.log(level.compactName());
                            if (board[i - 1].value !== score.score.value - 1) {
                                break;
                            }
                            console.log(
                                `${level.compactName()} Rank ${score.score.rank} Lower: ${
                                    board[i - 1].owner.display_name
                                } $${board[i - 1].value} Cheated? ${
                                    score.score.owner.display_name
                                } $${score.score.value}`
                            );
                            break;
                        }
                    }
                }
            }
        }
    } else {
        console.log("No profile");
    } */

    await database.close();
    await userDB.close();
}

main();
