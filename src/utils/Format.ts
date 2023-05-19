import { LeaderboardType } from "../LeaderboardInterface";

export const priceFormat = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    useGrouping: true,
    maximumFractionDigits: 0,
});
export const stressFormat = new Intl.NumberFormat("en-US", {
    useGrouping: true,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});

export function FormatScore(score: number, type: LeaderboardType) {
    if (type === "stress") {
        return stressFormat.format(score / 100) + "%";
    }

    return priceFormat.format(score);
}
