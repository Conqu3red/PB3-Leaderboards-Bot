import { createCanvas } from "canvas";
import { LeaderboardType } from "./LeaderboardInterface";
import { campaignBuckets, LevelBucket } from "./resources/Buckets";
import { CampaignLevel } from "./resources/CampaignLevel";
import { FormatScore } from "./utils/Format";
import { WeeklyLevel } from "./resources/WeeklyLevel";

export interface HistogramBucket {
    f: number;
    startValue: number;
    endValue: number;
}

const LAST_BUCKET_EXCLUDE_THRESHOLD = 2;

export function collectBuckets(levelBucket: LevelBucket): HistogramBucket[] {
    // On many levels, a couple of users have scores WAY higher than the max budget
    let histBuckets: HistogramBucket[] = [];
    for (let i = 0; i < levelBucket.start.length; i++) {
        histBuckets.push({
            startValue: levelBucket.start[i],
            endValue: levelBucket.end[i],
            f: levelBucket.count[i],
        });
    }

    return histBuckets;
}

export async function getHistogramBuckets(
    level: CampaignLevel | WeeklyLevel,
    type: LeaderboardType
): Promise<HistogramBucket[] | null> {
    const allBuckets = await campaignBuckets.get();
    const levelBuckets = allBuckets[level.info.id];
    if (!levelBuckets) {
        return null;
    }

    return collectBuckets(levelBuckets[type]);
}

const WIDTH = 800;
const HEIGHT = 400;
const GUTTER = 100;
const BORDER = 20;
const y_scale = 1;

export interface RenderConfig {
    type: LeaderboardType;
    levelBudget?: number;
    userScore?: number;
    userPercentile?: number;
}

export function renderHistogram(hist: HistogramBucket[], config: RenderConfig) {
    const canvas = createCanvas(WIDTH + 2 * BORDER, HEIGHT + 2 * GUTTER + 2 * BORDER);
    const ctx = canvas.getContext("2d");

    ctx.imageSmoothingEnabled = true;
    ctx.fillStyle = "#1C1C1C";
    ctx.fillRect(0, 0, WIDTH + 2 * BORDER, HEIGHT + 2 * GUTTER + 2 * BORDER);

    const GREY_COLORS = ["#1C1C1C", "#212121"];
    const OVERBUDGET_COLORS = ["#DD453D", "#E55147"];
    const UNDERBUDGET_COLORS = ["#32B255", "#3DB75D"];
    const GENERIC_COLORS = UNDERBUDGET_COLORS;

    const max_fd = Math.max(...hist.map((p) => p.f / (p.endValue - p.startValue)));
    const valueRange = hist[hist.length - 1].endValue - hist[0].startValue;

    let previous_endPixel = WIDTH;

    for (let i = 0; i < hist.length; i++) {
        const bucket = hist[i];
        const cw = bucket.endValue - bucket.startValue;
        const fd = bucket.f / cw;

        const x = bucket.startValue - hist[0].startValue;

        const new_startPixel = Math.round(WIDTH * (1 - x / valueRange));
        const pixel_difference = previous_endPixel - new_startPixel;

        const target_width = Math.round(WIDTH * (-cw / valueRange));
        const adjusted_width = target_width - pixel_difference;

        // background
        ctx.fillStyle = GREY_COLORS[i % GREY_COLORS.length];
        ctx.fillRect(BORDER + previous_endPixel, GUTTER + BORDER, adjusted_width, HEIGHT);

        if (config.levelBudget) {
            if (bucket.endValue < config.levelBudget)
                ctx.fillStyle = UNDERBUDGET_COLORS[i % UNDERBUDGET_COLORS.length];
            else ctx.fillStyle = OVERBUDGET_COLORS[i % OVERBUDGET_COLORS.length];
        } else {
            ctx.fillStyle = GENERIC_COLORS[i % GENERIC_COLORS.length];
        }

        // bar
        ctx.fillRect(
            BORDER + previous_endPixel,
            GUTTER + BORDER + HEIGHT * (1 - (y_scale * fd) / max_fd),
            adjusted_width,
            HEIGHT * ((y_scale * fd) / max_fd)
        );

        previous_endPixel += adjusted_width;
    }
    /* if (levelBudget) {
        ctx.strokeStyle = "white";
        ctx.globalAlpha = 1;
        ctx.beginPath();
        ctx.setLineDash([5, 5]);
        ctx.moveTo(BORDER + WIDTH * (1 - (levelBudget - hist[0].startValue) / valueRange), BORDER);
        ctx.lineTo(
            BORDER + WIDTH * (1 - (levelBudget - hist[0].startValue) / valueRange),
            BORDER + HEIGHT
        );
        ctx.stroke();
        ctx.closePath();
    } */

    // draw quartile markers
    const QUARTILE_MARKER_HEIGHT = 25;
    ctx.strokeStyle = "#FCAB0D";
    ctx.lineWidth = 5;
    ctx.setLineDash([]);
    ctx.lineCap = "square";
    ctx.beginPath();

    ctx.moveTo(BORDER, GUTTER + BORDER + HEIGHT + 10);
    ctx.lineTo(BORDER + WIDTH, GUTTER + BORDER + HEIGHT + 10);

    for (let i = 0; i <= 100; i += 25) {
        const x = (i / 100) * WIDTH;
        ctx.moveTo(BORDER + x, GUTTER + BORDER + HEIGHT + 10);
        ctx.lineTo(BORDER + x, GUTTER + BORDER + HEIGHT + 10 + QUARTILE_MARKER_HEIGHT);
    }
    ctx.stroke();
    ctx.closePath();

    // Budget text high
    ctx.font = "25px sans-serif";
    ctx.textAlign = "left";
    ctx.fillStyle = "white";

    ctx.fillText(
        `${FormatScore(Math.round(hist[hist.length - 1].endValue), config.type)}`,
        BORDER - 5,
        GUTTER + BORDER + HEIGHT + 10 + QUARTILE_MARKER_HEIGHT + 30
    );

    // Budget text low
    ctx.font = "25px sans-serif";
    ctx.textAlign = "right";
    ctx.fillStyle = "white";

    ctx.fillText(
        `${FormatScore(Math.round(hist[0].startValue), config.type)}`,
        BORDER + WIDTH + 5,
        GUTTER + BORDER + HEIGHT + 10 + QUARTILE_MARKER_HEIGHT + 30
    );

    if (config.userScore !== undefined) {
        const userScore = Math.max(
            hist[0].startValue,
            Math.min(hist[hist.length - 1].endValue, config.userScore)
        );
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = "#FCAB0D";
        ctx.globalAlpha = 1;
        ctx.beginPath();
        ctx.setLineDash([5, 5]);
        ctx.moveTo(
            BORDER + WIDTH * (1 - (userScore - hist[0].startValue) / valueRange),
            GUTTER / 2 + BORDER
        );
        ctx.lineTo(
            BORDER + WIDTH * (1 - (userScore - hist[0].startValue) / valueRange),
            GUTTER + BORDER + HEIGHT
        );
        ctx.stroke();
        ctx.closePath();

        ctx.font = "20px sans-serif";
        ctx.textAlign = (userScore - hist[0].startValue) / valueRange > 0.5 ? "left" : "right";
        ctx.fillStyle = "#FCAB0D";

        const line1 = `${FormatScore(Math.round(userScore), config.type)}`;
        const line2 = `Top ${config.userPercentile}%`;

        ctx.fillText(
            line1,
            BORDER + WIDTH * (1 - (userScore - hist[0].startValue) / valueRange),
            GUTTER / 2 + BORDER - 20 - 10
        );
        ctx.fillText(
            line2,
            BORDER + WIDTH * (1 - (userScore - hist[0].startValue) / valueRange),
            GUTTER / 2 + BORDER - 10
        );
    }

    return canvas.toBuffer();
}
