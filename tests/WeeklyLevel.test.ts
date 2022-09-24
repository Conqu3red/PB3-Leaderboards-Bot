import {
    Leaderboard,
    LeaderboardEntry,
    LevelLeaderboards,
    OldestEntry,
    WeeklyLevelInfo,
} from "../src/LeaderboardInterface";
import { Remote } from "../src/RemoteLeaderboardInterface";
import assert from "assert";
import { WeeklyLevel } from "../src/resources/WeeklyLevel";

function getTestLevel(): WeeklyLevel {
    let levelInfo: WeeklyLevelInfo = {
        id: "Vl5gb",
        week: 95,
        title: "Week 95",
        preview: "placeholder",
        payload: "",
    };

    return new WeeklyLevel(levelInfo, 8 * 60 * 60 * 60 * 1000);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("Weekly Level Processing", () => {
    it("One score", async () => {
        let level = getTestLevel();

        await level.reload();

        console.log(await level.get());
    });
});
