import { SimpleResource } from "./RemoteResource";
import { WeeklyLevelInfo } from "../LeaderboardInterface";
import { steamUser } from "./SteamUser";

export const extractBudgetFromDescription = (description: string): number => {
    if (description.startsWith("v2")) {
        return parseInt(description.slice(3).split(",", 1)[0]);
    }
    return parseInt(description.split(",", 1)[0]);
};

export const weeklyIndex = new SimpleResource<WeeklyLevelInfo[], ArrayBuffer>(
    60 * 60 * 1000,
    "weeklyChallenges.json",
    "weeklies/manifest",
    [],
    async (remote) => {
        const lines = Buffer.from(remote).toString().split("\n");
        const weeks: WeeklyLevelInfo[] = [];

        for (const line of lines.slice(1)) {
            if (!line) continue;
            const [id, author_id, week] = line.split("\t");

            const files = (await steamUser.getPublishedFileDetails(parseInt(id))).files;
            const details = Object.values(files)[0];

            weeks.push({
                id,
                author_id,
                week: parseInt(week),
                title: details.title,
                budget: extractBudgetFromDescription(details.file_description),
                preview: details.preview_url,
                latest: false,
            });
        }

        if (weeks.length > 0) weeks[weeks.length - 1].latest = true;

        return weeks;
    }
);
