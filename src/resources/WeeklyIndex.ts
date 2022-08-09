import { CdnResource, SimpleResource } from "./CdnResource";
import { WeeklyLevelInfo } from "../LeaderboardInterface";

export const weeklyIndex = new SimpleResource<WeeklyLevelInfo[], WeeklyLevelInfo[]>(
    60 * 60 * 1000,
    "weeklyChallenges.json",
    "manifests/weeklyChallenges.json",
    [],
    async (old, remote) => remote
);
