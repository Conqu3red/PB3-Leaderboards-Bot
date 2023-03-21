import { Canvas, createCanvas } from "canvas";
import { LeaderboardType } from "./LeaderboardInterface";
import { campaignBuckets, LevelBucket } from "./resources/Buckets";
import { CampaignLevel } from "./resources/CampaignLevel";
import { implyMissingBuckets } from "./Milestones";

export interface HistogramBucket {
    f: number;
    startValue: number;
    endValue: number;
}

function constrainBucketsToBudget(buckets: LevelBucket[], levelBudget: number) {
    let shift = levelBudget;
    for (let i = buckets.length - 1; i >= 0; i--) {
        let bucket = buckets[i];
        if (bucket.endValue >= shift) {
            bucket.endValue = shift;
            shift--;
        }

        if (bucket.startValue >= shift) {
            bucket.startValue = shift;
            shift--;
        }
    }
}

const LAST_BUCKET_EXCLUDE_THRESHOLD = 2;

export function collectBuckets(
    hist: LevelBucket[],
    bucketCount: number,
    levelBudget?: number,
    extendedRange?: boolean
): HistogramBucket[] {
    // On many levels, a couple of users have scores WAY higher than the max budget
    constrainBucketsToBudget(
        hist,
        levelBudget === undefined
            ? hist[hist.length - 1].startValue * LAST_BUCKET_EXCLUDE_THRESHOLD
            : levelBudget * 2
    );

    const first_value = extendedRange ? 0 : hist[0].startValue;
    const final_value =
        extendedRange && levelBudget ? levelBudget * 2 : hist[hist.length - 1].endValue;
    const value_range = final_value - first_value;

    let groups: HistogramBucket[] = [];

    let i = 0;
    let group_n = 0;
    let group: HistogramBucket = {
        f: 0,
        startValue: first_value,
        endValue: first_value + (1 / bucketCount) * value_range,
    };
    while (i < hist.length) {
        const bucket = hist[i];

        // interpolate between
        const included_f =
            (Math.min(group.endValue, bucket.endValue) -
                Math.max(group.startValue, bucket.startValue)) /
            (bucket.endValue - bucket.startValue);

        if (included_f > 0) {
            group.f += included_f;
        } else if (bucket.endValue === bucket.startValue && group.startValue <= bucket.startValue) {
            // Edge case where bucket has 0 width, include 1 frequency
            group.f += 1;
        }

        if (bucket.endValue <= group.endValue) {
            i++;
        }

        if (included_f < 0 || bucket.endValue >= group.endValue) {
            // move to next group
            groups.push(group);
            group_n++;
            group = {
                f: 0,
                startValue: first_value + (group_n / bucketCount) * value_range,
                endValue: first_value + ((group_n + 1) / bucketCount) * value_range,
            };
        }
    }

    if (group.f > 0) groups.push(group);

    return groups;
}

export async function getHistogramBuckets(
    level: CampaignLevel,
    type: LeaderboardType,
    bucketCount: number
): Promise<HistogramBucket[] | null> {
    const allBuckets = await campaignBuckets.get();
    const levelBuckets = allBuckets[level.info.id];
    if (!levelBuckets) {
        return null;
    }
    const buckets = implyMissingBuckets(levelBuckets[type]);

    return collectBuckets(buckets, bucketCount, level.info.budget);
}

const WIDTH = 800;
const HEIGHT = 400;
const GUTTER = 100;
const BORDER = 20;
const y_scale = 1;

export interface RenderConfig {
    levelBudget?: number;
    userScore?: number;
    userPercentile?: number;
}

export function renderHistogram(hist: HistogramBucket[], config: RenderConfig) {
    const canvas = createCanvas(WIDTH + 2 * BORDER, HEIGHT + 2 * GUTTER + 2 * BORDER);
    const ctx = canvas.getContext("2d");

    ctx.fillStyle = "#1e2124";
    ctx.fillRect(0, 0, WIDTH + 2 * BORDER, HEIGHT + 2 * GUTTER + 2 * BORDER);

    const GREY_COLORS = ["#171e22", "#22282a"];
    const OVERBUDGET_COLORS = ["#D22B2B", "#C41E3A"];
    const UNDERBUDGET_COLORS = ["#32CD32", "#4CBB17"];
    const GENERIC_COLORS = UNDERBUDGET_COLORS;

    const max_fd = Math.max(...hist.map((p) => p.f / (p.endValue - p.startValue)));
    const valueRange = hist[hist.length - 1].endValue - hist[0].startValue;

    for (let i = 0; i < hist.length; i++) {
        const bucket = hist[i];
        const cw = bucket.endValue - bucket.startValue;
        const fd = bucket.f / cw;

        const x = bucket.startValue - hist[0].startValue;

        // background
        ctx.fillStyle = GREY_COLORS[i % GREY_COLORS.length];
        ctx.fillRect(
            BORDER + WIDTH * (1 - x / valueRange),
            GUTTER + BORDER,
            WIDTH * (-cw / valueRange),
            HEIGHT
        );

        if (config.levelBudget) {
            if (x + cw / 2 < config.levelBudget)
                ctx.fillStyle = UNDERBUDGET_COLORS[i % UNDERBUDGET_COLORS.length];
            else ctx.fillStyle = OVERBUDGET_COLORS[i % OVERBUDGET_COLORS.length];
        } else {
            ctx.fillStyle = GENERIC_COLORS[i % GENERIC_COLORS.length];
        }

        // bar
        ctx.fillRect(
            BORDER + WIDTH * (1 - x / valueRange),
            GUTTER + BORDER + HEIGHT * (1 - (y_scale * fd) / max_fd),
            WIDTH * (-cw / valueRange),
            HEIGHT * ((y_scale * fd) / max_fd)
        );
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
    const QUARTILE_MARKER_HEIGHT = 10;
    ctx.strokeStyle = "white";
    ctx.lineWidth = 2.5;
    ctx.setLineDash([]);
    ctx.lineCap = "round";
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
    ctx.font = "20px sans-serif";
    ctx.textAlign = "left";
    ctx.fillStyle = "white";

    ctx.fillText(
        `$${Math.round(hist[hist.length - 1].endValue).toLocaleString("en-US")}`,
        BORDER - 5,
        GUTTER + BORDER + HEIGHT + 10 + QUARTILE_MARKER_HEIGHT + 20
    );

    // Budget text low
    ctx.font = "20px sans-serif";
    ctx.textAlign = "right";
    ctx.fillStyle = "white";

    ctx.fillText(
        `$${Math.round(hist[0].startValue).toLocaleString("en-US")}`,
        BORDER + WIDTH + 5,
        GUTTER + BORDER + HEIGHT + 10 + QUARTILE_MARKER_HEIGHT + 20
    );

    if (config.userScore) {
        const userScore = Math.max(
            hist[0].startValue,
            Math.min(hist[hist.length - 1].endValue, config.userScore)
        );
        ctx.strokeStyle = "white";
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
        ctx.fillStyle = "white";

        const line1 = `$${Math.round(userScore).toLocaleString("en-US")}`;
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
