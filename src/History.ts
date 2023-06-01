import { createCanvas } from "canvas";
import { LeaderboardEntry, LeaderboardType, OldestEntry } from "./LeaderboardInterface";
import { groupBy } from "./Oldest";
import { CampaignLevel } from "./resources/CampaignLevel";
import { DateTime } from "luxon";
import { FormatScore } from "./utils/Format";
import SteamUsernames from "./resources/SteamUsernameHandler";
import { GlobalHistory, GlobalHistoryEntry } from "./resources/GlobalHistory";
import { ScoringMode } from "./GlobalLeaderboard";
import { SumOfBestHistory, SumOfBestHistoryEntry } from "./resources/SumOfBestHistory";
import { WorldFilter } from "./utils/WorldFilter";

export interface TimelineScore {
    score: number;
    steam_id_user?: string;
}

export interface TimelineGroup {
    time: number;
    isTieBreaker: boolean;
    scores: TimelineScore[];
}

export interface Timeline {
    groups: TimelineGroup[];
}

export function createTimeline(history: OldestEntry[], includeTies: boolean): Timeline {
    history = history.filter((entry) => !entry.cheated);
    let topHistory: OldestEntry[] = history.sort((a, b) => a.time - b.time);

    let timeBrackets: Map<number, OldestEntry[]> = groupBy(topHistory, (obj) => obj.time);
    let lowestScore = Infinity;

    let userScores: Map<string, OldestEntry> = new Map();

    let timeline: Timeline = { groups: [] };

    for (const [time, scores] of timeBrackets) {
        const newLowestScore = Math.min(...scores.map((score) => score.score));

        if (newLowestScore > lowestScore) continue;

        let group: TimelineGroup = {
            time,
            isTieBreaker: newLowestScore !== lowestScore,
            scores: [],
        };

        lowestScore = newLowestScore;

        if (!includeTies && !group.isTieBreaker) continue;

        for (const score of scores) {
            if (score.score > lowestScore) continue;

            userScores.set(score.steam_id_user, score);
        }

        // remove top users that no longer meet the top score
        for (const [id, entry] of userScores) {
            if (entry.score > lowestScore) {
                userScores.delete(id);
            }
        }

        group.scores = [...userScores.values()];

        timeline.groups.push(group);
    }

    return timeline;
}

export function createGlobalTimeline(
    history: GlobalHistoryEntry[],
    includeTies: boolean
): Timeline {
    let topHistory = history.sort((a, b) => a.time - b.time);
    let timeBrackets: Map<number, GlobalHistoryEntry[]> = groupBy(topHistory, (obj) => obj.time);
    let timeline: Timeline = { groups: [] };

    let prevScore = Infinity;

    let brackets = Array.from(timeBrackets);

    let newestIndex = -1;
    for (let i = brackets.length - 1; i >= 0; i--) {
        if (brackets[i][1].find((e) => e.rank === 1)) {
            newestIndex = i;
            break;
        }
    }

    for (let i = 0; i < brackets.length; i++) {
        const [time, scores] = brackets[i];

        const topScores = scores.filter((score) => score.rank === 1);
        if (topScores.length === 0) continue;

        const newLowestScore = Math.min(...topScores.map((score) => score.value));

        let group: TimelineGroup = {
            time,
            isTieBreaker: newLowestScore !== prevScore,
            scores: [],
        };

        if (!includeTies && !group.isTieBreaker) continue;

        for (const score of topScores) {
            if (score.value == newLowestScore) {
                group.scores.push({ score: score.value, steam_id_user: score.steam_id_user });
            }
        }

        const hasNewUser =
            timeline.groups.length === 0 ||
            group.scores.find(
                (score) =>
                    !timeline.groups[timeline.groups.length - 1].scores.find(
                        (oldScore) => score.steam_id_user === oldScore.steam_id_user
                    )
            );

        const isImprovement = newLowestScore < prevScore;
        const isLatest = i === newestIndex;

        if (hasNewUser || isLatest) {
            prevScore = newLowestScore;
            timeline.groups.push(group);
        }
    }

    return timeline;
}

export function createSumOfBestTimeline(
    history: SumOfBestHistoryEntry[],
    includeTies: boolean
): Timeline {
    let topHistory = history.sort((a, b) => a.time - b.time);
    let timeline: Timeline = { groups: [] };

    let prevScore = Infinity;

    for (const score of topHistory) {
        let group: TimelineGroup = {
            time: score.time,
            isTieBreaker: score.score !== prevScore,
            scores: [{ score: score.score, steam_id_user: undefined }],
        };

        if (!includeTies && !group.isTieBreaker) continue;

        prevScore = score.score;
        timeline.groups.push(group);
    }

    return timeline;
}

export function getTimeline(level: CampaignLevel, type: LeaderboardType, includeTies: boolean) {
    const history = level.getHistory(type);
    return createTimeline(history, includeTies);
}

export function getGlobalTimeline(
    type: LeaderboardType,
    scoringMode: ScoringMode,
    includeTies: boolean
) {
    const history = GlobalHistory.get(type, scoringMode);
    return createGlobalTimeline(history, includeTies);
}

export function getSumOfBestTimeline(
    type: LeaderboardType,
    world: string | null,
    includeTies: boolean
) {
    const history = SumOfBestHistory.get(type, world);
    return createSumOfBestTimeline(history, includeTies);
}

const WIDTH = 900;
const BORDER = 20;
const LINE_X = BORDER + WIDTH / 2;
const SPACING = 120;

const PER_GROUP = SPACING + 40;

export const PER_PAGE = 8;

const HEIGHT = 2 * SPACING + (PER_PAGE - 1) * PER_GROUP;

export function renderTimeline(
    timeline: Timeline,
    page_index: number,
    type: LeaderboardType,
    scoringMode: ScoringMode
) {
    const canvas = createCanvas(WIDTH + 2 * BORDER, HEIGHT + 2 * BORDER);
    const ctx = canvas.getContext("2d");

    const chosen_groups = timeline.groups.slice(page_index * PER_PAGE, (page_index + 1) * PER_PAGE);

    ctx.imageSmoothingEnabled = true;
    ctx.fillStyle = "#1C1C1C";
    ctx.fillRect(0, 0, WIDTH + 2 * BORDER, HEIGHT + 2 * BORDER);

    let y = BORDER + SPACING;

    ctx.lineWidth = 5;
    ctx.strokeStyle = "white"; // TODO: test colours
    ctx.globalAlpha = 1;

    const lineStartY = page_index > 0 ? 0 : y;
    const lineEndY =
        Math.ceil(timeline.groups.length / PER_PAGE) - 1 === page_index
            ? y + (chosen_groups.length - 1) * PER_GROUP
            : 2 * BORDER * HEIGHT;

    ctx.beginPath();
    ctx.moveTo(BORDER + LINE_X, lineStartY);
    ctx.lineTo(BORDER + LINE_X, lineEndY);
    ctx.stroke();
    ctx.closePath();

    ctx.font = "40px sans-serif";

    for (const group of chosen_groups) {
        ctx.lineWidth = 5;
        ctx.strokeStyle = "white";
        ctx.fillStyle = "#1C1C1C";
        ctx.beginPath();
        ctx.ellipse(BORDER + LINE_X, y, 20, 20, 0, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();
        ctx.closePath();

        ctx.textAlign = "right";
        ctx.fillStyle = "white";
        const time = DateTime.fromSeconds(group.time);
        const fine = time.toFormat("HH:mm");
        const date = time.toFormat("LLL dd yyyy");

        ctx.textBaseline = "bottom";
        ctx.fillText(fine, BORDER + LINE_X - 50, y);

        ctx.textBaseline = "top";
        ctx.fillText(date, BORDER + LINE_X - 50, y);

        ctx.textAlign = "left";

        const score = group.scores[0];
        ctx.textBaseline = score.steam_id_user ? "bottom" : "middle";
        const renderedScore =
            scoringMode === "rank"
                ? score.score.toLocaleString("en-US")
                : FormatScore(score.score, type);
        ctx.fillText(renderedScore, BORDER + LINE_X + 50, y);

        if (score.steam_id_user) {
            ctx.textBaseline = "top";
            ctx.fillText(SteamUsernames.get(score.steam_id_user), BORDER + LINE_X + 50, y);
            if (group.scores.length > 1) {
                ctx.fillText(`(+${group.scores.length - 1} more)`, BORDER + LINE_X + 50, y + 40);
            }
        }

        y += PER_GROUP;
    }

    return canvas.toBuffer();
}
