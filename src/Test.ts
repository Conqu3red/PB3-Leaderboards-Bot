import { weeklyIndex } from "./resources/WeeklyIndex";
import { WeeklyLevel } from "./resources/WeeklyLevel";
import { cacheManager, CampaignManager, WeeklyManager } from "./resources/CacheManager";
import { campaignBuckets } from "./resources/Buckets";
import { configureHttp } from "./resources/ConfigureHttpAgents";
import { globalLeaderboard, GlobalScoreByBudget } from "./GlobalLeaderboard";
import { getProfile, scoreCountThresholds } from "./Profile";
import { sumOfBest } from "./SumOfBest";
import { getOldest, getTopUserStreaks, groupBy } from "./Oldest";
import { TIME_FORMAT } from "./Consts";
import { DateTime } from "luxon";
import { renderBoard } from "./TopLeaderboard";
import { findAllUsersWithUsername } from "./UserFinder";
import { userMatchesUsername } from "./utils/userFilter";
import { getAllPercentiles, implyMissingBuckets, getPercentile } from "./Milestones";
import { renderHistogram, collectBuckets } from "./ScoreDistribution";
import { Remote } from "./RemoteLeaderboardInterface";
import database from "./resources/Lmdb";
import fs from "fs";
import { encodeLevelCode } from "./LevelCode";

async function weeklyTest() {
    console.log(weeklyIndex.lastReloadTimeMs);
    let latest = await cacheManager.weeklyManager.getLatest();

    console.log(latest);
}

async function otherStuff() {
    let level = await cacheManager.campaignManager.getByCode("1-1");
    console.log(level);

    await campaignBuckets.reload();
    let buckets = await campaignBuckets.get();
    let levelBuckets = buckets["mAp2V"];
    if (levelBuckets) {
        console.log(levelBuckets.any[0]);
    }

    console.time("globalBoard");
    let globalBoard = await globalLeaderboard({
        type: "any",
        levelCategory: "all",
        scoreComputer: "moneyspent",
    });
    console.timeEnd("globalBoard");

    console.time("globalBoard");
    globalBoard = await globalLeaderboard({
        type: "any",
        levelCategory: "all",
        scoreComputer: "rank",
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
    let buckets = await campaignBuckets.get();
    let levelBuckets = buckets["mAp2V"];
    if (levelBuckets) {
        const filled = implyMissingBuckets(levelBuckets.any);

        for (let i = 0; i < levelBuckets.any.length; i++) {
            const b = levelBuckets.any[i];
            const f = filled[i];
            console.log(i, b, f);
        }
    }

    if (level) {
        let percentiles = await getAllPercentiles(
            level,
            "any",
            [...Array(99).keys()].map((i) => i + 1)
        );

        if (percentiles) {
            console.log("Actual percentiles:");
            console.log(percentiles.length);
            for (const p of percentiles) {
                console.log(p);
            }
        }
    }

    let most: string = "";
    let max = 0;
    for (const l of cacheManager.campaignManager.campaignLevels) {
        let p = ((await getAllPercentiles(l, "any", [100])) ?? [])[0];
        if (p.bucket.endValue > max) {
            max = p.bucket.endValue;
            most = l.compactName();
        }
    }
    console.log(`${most}: $${max.toLocaleString("en-US")}`);
}

async function main() {
    configureHttp();

    // await weeklyTest();
    await otherStuff();

    await cacheManager.campaignManager.maybeReload();
    await cacheManager.weeklyManager.maybeReload();

    //await Promise.all(cacheManager.campaignManager.campaignLevels.map((l) => l.reload()));

    let level = await cacheManager.campaignManager.getByCode("1-1");

    if (level) {
        console.log("OLDEST 1-1");
        const history = level.getHistory(false);
        for (const entry of history) {
            if (entry.cheated) {
                console.log(
                    `   ---- CHEATED ${DateTime.fromSeconds(entry.time).toISODate()} #${
                        entry.rank
                    } $${entry.value} ${entry.owner.display_name}`
                );
            } else {
                console.log(
                    `    ${DateTime.fromSeconds(entry.time).toISODate()} #${entry.rank} $${
                        entry.value
                    } ${entry.owner.display_name}`
                );
            }
        }

        console.time("oldest");
        let t = getTopUserStreaks(level.getHistory(false));
        console.timeEnd("oldest");
        if (t) {
            console.log(t.length);
            let now = DateTime.now();
            for (const user of t) {
                console.log(
                    `${Math.floor(
                        now.diff(DateTime.fromSeconds(user.initialTime)).as("days")
                    )}d ago: $${user.latestScore.value} (${user.latestScore.owner.display_name})`
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
                user.latestScore.value
            } (${user.latestScore.owner.display_name})`
        );
        break;
    }

    console.log(
        "Users with name:",
        await findAllUsersWithUsername(cacheManager.campaignManager.campaignLevels, "alex")
    );

    let buckets = await campaignBuckets.get();
    let level2 = await cacheManager.campaignManager.getByCode("1-10");
    if (level2) {
        let levelBuckets = buckets[level2.info.id];
        if (levelBuckets) {
            const histogram_buckets = implyMissingBuckets(levelBuckets.any);

            /* for (const b of histogram_buckets) {
                let f = (b.endRank - b.startRank).toString().padStart(6, " ");
                let cw = (b.endValue - b.startValue).toString().padStart(6, " ");
                console.log(
                    `${f} ${cw} ${b.fd.toFixed(3).padStart(6, " ")} ${"#".repeat(
                        Math.round(b.fd * 20)
                    )}`
                );
            } */

            const split = collectBuckets(histogram_buckets, 40, level2.info.budget);
            const max_fd = Math.max(...split.map((s) => s.f / (s.endValue - s.startValue)));
            for (const x of split) {
                console.log(
                    `${(x.endValue - x.startValue).toFixed(3)} ${x.f.toFixed(3)} ${"#".repeat(
                        Math.round((x.f / (x.endValue - x.startValue) / max_fd) * 20)
                    )}`
                );
            }

            const buf = renderHistogram(split, {
                levelBudget: level2.info.budget,
                userScore: 26000,
                userPercentile: getPercentile(26000, histogram_buckets),
            });
            fs.writeFileSync(`./distributions/test.png`, buf);
        }
    }

    /* for (const level of cacheManager.campaignManager.campaignLevels) {
        let levelBuckets = buckets[level.info.id];
        if (levelBuckets) {
            const histogram_buckets = implyMissingBuckets(levelBuckets.any);
            const split = collectBuckets(histogram_buckets, 40, level.info.budget);

            const buf = renderHistogram(split, { levelBudget: level.info.budget });
            fs.writeFileSync(`./distributions/${encodeLevelCode(level.info.code)}.png`, buf);
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
}

main();
