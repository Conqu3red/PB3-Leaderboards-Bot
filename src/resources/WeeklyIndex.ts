import { SimpleResource } from "./RemoteResource";
import { WeeklyLevelInfo } from "../LeaderboardInterface";
import { steamAPI, steamUser } from "./SteamUser";
import { GetPublishedFileDetails } from "./Steam";
import { PB3_WEEKLY_MODOLUS } from "../Consts";

export const extractBudgetFromDescription = (description: string): number => {
    if (description.startsWith("v2")) {
        return parseInt(description.slice(3).split(",", 1)[0]);
    }
    return parseInt(description.split(",", 1)[0]);
};

export const weeklyIndex = new SimpleResource<WeeklyLevelInfo[], ArrayBuffer>(
    60 * 60 * 1000,
    "weeklyChallenges.json",
    "weeklies/manifestloop",
    [],
    async (remote) => {
        let lines = Buffer.from(remote).toString().split("\n").slice(1);

        let weeksBasic = lines.map(line => {
            let [id, author_id, weekStr] = line.split("\t");
            // If after first loop, id is encoded with loop number too.
            // E.g. 2998255038 01 - last two digits are loop number
            const week = parseInt(weekStr);
            if (week > PB3_WEEKLY_MODOLUS) id = id.slice(0, -2);
            return {id, author_id, week};
        }).filter(w => !isNaN(w.week));
        
        const lookup = new Map(weeksBasic.map(w => [w.id, w]));
        let weeks: WeeklyLevelInfo[] = [];

        while (weeksBasic.length > 0) {
            const queued = weeksBasic.splice(0, 100);

            // Fetch steam details for these levels:
            console.log(`[CacheManager] Reloading ${queued.length} weekly level's metadata...`);
            const details = await GetPublishedFileDetails(steamAPI, queued.map(w => w.id));
            for (const detail of details.publishedfiledetails) {
                const weekData = lookup.get(detail.publishedfileid);
                if (!weekData || detail.result != 1) {
                    console.log(`[CacheManager] ERR: missing week data for file ${detail.publishedfileid} - ${detail.title}`);
                    continue;
                }
                const {id, author_id, week} = weekData;
                weeks.push({
                    id,
                    author_id,
                    week,
                    title: detail.title,
                    budget: extractBudgetFromDescription(detail.file_description),
                    preview: detail.preview_url,
                    latest: false
                });
            }
        }

        weeks = weeks.sort((a,b) => a.week - b.week);

        if (weeks.length > 0) weeks[weeks.length - 1].latest = true;

        return weeks;
    }
);
