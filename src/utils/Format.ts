import { LeaderboardType } from "../LeaderboardInterface";

export function FormatScore(score: number, type: LeaderboardType) {
    if (type === "stress") {
        return (score / 100).toLocaleString("en-US") + "%";
    }

    return "$" + score.toLocaleString("en-US");
}
