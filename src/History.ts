import { createCanvas } from "canvas";
import { LeaderboardEntry, LeaderboardType, OldestEntry } from "./LeaderboardInterface";
import { groupBy } from "./Oldest";
import { CampaignLevel } from "./resources/CampaignLevel";
import { DateTime } from "luxon";
import { FormatScore } from "./utils/Format";
import SteamUsernames from "./resources/SteamUsernameHandler";

export interface TimelineGroup {
    time: number;
    isTieBreaker: boolean;
    scores: OldestEntry[];
}

export interface Timeline {
    groups: TimelineGroup[];
}

export function createTimeline(history: OldestEntry[], includeTies: boolean): Timeline {
    history = history.filter((entry) => !entry.cheated);
    let topHistory: OldestEntry[] = history.sort((a, b) => a.time - b.time);

    let timeBrackets: Map<number, OldestEntry[]> = groupBy(topHistory, (obj) => obj.time);
    let lowestScore = Infinity;

    let timeline: Timeline = { groups: [] };

    for (const [time, scores] of timeBrackets) {
        const newLowestScore = Math.min(...scores.map((score) => score.score));

        if (newLowestScore > lowestScore) continue;

        let group: TimelineGroup = {
            time,
            isTieBreaker: newLowestScore === lowestScore,
            scores: [],
        };

        if (!includeTies && group.isTieBreaker) continue;

        for (const score of scores) {
            if (score.score == newLowestScore) {
                group.scores.push(score);
            }
        }

        lowestScore = newLowestScore;
        timeline.groups.push(group);
    }

    return timeline;
}

export function getTimeline(level: CampaignLevel, type: LeaderboardType, includeTies: boolean) {
    const history = level.getHistory(type);
    return createTimeline(history, includeTies);
}

const WIDTH = 900;
const BORDER = 20;
const LINE_X = BORDER + WIDTH / 2;
const SPACING = 120;

const PER_GROUP = SPACING + 40;

export const PER_PAGE = 8;

const HEIGHT = 2 * SPACING + (PER_PAGE - 1) * PER_GROUP;

export function renderTimeline(timeline: Timeline, page_index: number, type: LeaderboardType) {
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
        ctx.textBaseline = "bottom";
        ctx.fillText(FormatScore(score.score, type), BORDER + LINE_X + 50, y);

        ctx.textBaseline = "top";
        ctx.fillText(SteamUsernames.get(score.steam_id_user), BORDER + LINE_X + 50, y);
        if (group.scores.length > 1) {
            ctx.fillText(`(+${group.scores.length - 1} more)`, BORDER + LINE_X + 50, y + 40);
        }

        y += PER_GROUP;
    }

    return canvas.toBuffer();
}
