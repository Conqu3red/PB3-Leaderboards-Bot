import { Canvas, createCanvas } from "canvas";
import { CanvasTable, CTColumn, CTConfig, CTData } from "canvas-table";
import { LeaderboardType } from "./LeaderboardInterface";
import { campaignBuckets, LevelBucket } from "./resources/Buckets";
import { CampaignLevel } from "./resources/CampaignLevel";

export interface BucketResult {
    percentile: number;
    interpolatedRank: number;
}

export function getPercentile(score: number, buckets: LevelBucket[]): number {
    for (let i = 0; i < buckets.length; i++) {
        let bucket = buckets[i];
        if (score <= bucket.startValue) {
            return Math.max(i, 1);
        }
    }

    return 100;
}

export function getInterpolatedRank(score: number, buckets: LevelBucket[]): number {
    for (let i = 0; i < 100; i++) {
        const bucket = buckets[i];
        if (bucket && score >= bucket.startValue && score <= bucket.endValue) {
            if (bucket.endValue == bucket.startValue) {
                return bucket.startRank;
            }
            const amountThroughValues =
                (score - bucket.startValue) / (bucket.endValue - bucket.startValue);
            return Math.round(
                bucket.startRank +
                    (bucket.endRank - bucket.startRank) *
                        Math.max(Math.min(amountThroughValues, 1), 0)
            );
        }
    }
    return 1;
}

export async function getPercentileForScore(
    level: CampaignLevel,
    type: LeaderboardType,
    score: number
): Promise<BucketResult | null> {
    const allBuckets = await campaignBuckets.get();
    const levelBuckets = allBuckets[level.info.id];
    if (!levelBuckets) {
        return null;
    }

    const buckets = implyMissingBuckets(levelBuckets[type]);

    return {
        interpolatedRank: getInterpolatedRank(score, buckets),
        percentile: getPercentile(score, buckets),
    };
}

export interface Percentile {
    percentile: number;
    bucket: LevelBucket;
}

function lerp(a: number, b: number, t: number) {
    return a + t * (b - a);
}

export function implyMissingBuckets(buckets: (LevelBucket | null)[]): LevelBucket[] {
    let result: LevelBucket[] = [];
    let prevValidBucket: LevelBucket = {
        startRank: 0,
        endRank: 0,
        startValue: 0,
        endValue: 0,
    };
    for (let i = 0; i < buckets.length; i++) {
        const bucket = buckets[i];
        if (bucket) {
            // bucket exists, add and move on
            prevValidBucket = bucket;
            result.push(bucket);
        } else {
            // we began a n length streak of null buckets, we need to fix them.
            const startBucket = prevValidBucket;
            let endBucket: LevelBucket | null = null;
            let j = 0;
            // find next valid bucket
            for (j = 0; i + j < buckets.length; j++) {
                const bucket = buckets[i + j];
                if (bucket) {
                    endBucket = bucket;
                    break;
                }
            }

            if (endBucket) {
                // we have a valid endBucket, in-between buckets can be populated intelligently
                for (let k = 0; k < j; k++) {
                    const tStart = k / j;
                    const tEnd = (k + 1) / j;
                    result.push({
                        startRank: Math.round(
                            lerp(startBucket.endRank, endBucket.startRank, tStart)
                        ),
                        endRank: Math.round(lerp(startBucket.endRank, endBucket.startRank, tEnd)),
                        startValue: Math.round(
                            lerp(startBucket.endValue, endBucket.startValue, tStart)
                        ),
                        endValue: Math.round(
                            lerp(startBucket.endValue, endBucket.startValue, tEnd)
                        ),
                    });
                }
            } else {
                // populate simply
                for (let k = 0; k < j; k++) {
                    result.push(startBucket);
                    // FIXME: repeating the start bucket may cause issues in rare cases
                }
            }

            i += j - 1;
        }
    }
    return result;
}

export async function getAllPercentiles(
    level: CampaignLevel,
    type: LeaderboardType,
    percentiles: number[]
): Promise<Percentile[] | null> {
    const allBuckets = await campaignBuckets.get();
    const levelBuckets = allBuckets[level.info.id];
    if (!levelBuckets) {
        return null;
    }
    const buckets = implyMissingBuckets(levelBuckets[type]);

    return percentiles.map((percentile) => {
        return { percentile: percentile, bucket: buckets[percentile - 1] };
    });
}

export async function renderPercentilesCanvas(percentiles: Percentile[]): Promise<Canvas> {
    const canvas = createCanvas(300, 25 * percentiles.length + 60);

    const columns: CTColumn[] = [
        { title: "%", options: { color: "#ffffff", textAlign: "right" } },
        { title: "Rank", options: { color: "#ffffff", textAlign: "right" } },
        { title: "Score", options: { color: "#ffffff", textAlign: "right" } },
    ];

    const data: CTData = percentiles.map((p) => [
        `${p.percentile}%`,
        p.bucket.endRank.toLocaleString("en-US"),
        `$${p.bucket.endValue.toLocaleString("en-US")}`,
    ]);

    // fit: true
    const config: CTConfig = {
        columns,
        data,
        options: {
            background: "#1e2124",
            header: {
                color: "#ffffff",
            },
            fit: true,
            fader: undefined,
            padding: {
                top: 10,
                bottom: 10,
                left: 10,
                right: 10,
            },
        },
    };
    const ct = new CanvasTable(canvas, config);
    await ct.generateTable();
    return canvas;
}

export async function renderPercentiles(percentiles: Percentile[]): Promise<Buffer> {
    const canvas = await renderPercentilesCanvas(percentiles);
    return canvas.toBuffer();
}

interface HistogramBucket {
    f: number;
    startValue: number;
    endValue: number;
}

function constrainBucketsToBudget(buckets: LevelBucket[], levelBudget: number) {
    let shift = levelBudget;
    for (let i = buckets.length - 1; i >= 0; i--) {
        let bucket = buckets[i];
        if (bucket.endValue > shift) {
            bucket.endValue = shift;
            shift--;
        }

        if (bucket.startValue > shift) {
            bucket.startValue = shift;
            shift--;
        }
    }
}

const LAST_BUCKET_EXCLUDE_THRESHOLD = 2;

export function collectBuckets(
    hist: LevelBucket[],
    bucketCount: number,
    levelBudget?: number
): HistogramBucket[] {
    // On many levels, a couple of users have scores WAY higher than the max budget
    constrainBucketsToBudget(
        hist,
        levelBudget === undefined
            ? hist[hist.length - 1].startValue * LAST_BUCKET_EXCLUDE_THRESHOLD
            : levelBudget * 2
    );

    const first_value = hist[0].startValue;
    const final_value = hist[hist.length - 1].endValue;
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

export function renderHistogram(
    hist: HistogramBucket[],
    levelBudget?: number,
    userScore?: number,
    userPercentile?: number
) {
    // TODO: Option to overlay any and unbroken
    const WIDTH = 400;
    const HEIGHT = 400;
    const GUTTER = 100;
    const BORDER = 20;
    const y_scale = 1;
    const canvas = createCanvas(WIDTH + 2 * BORDER, HEIGHT + 2 * GUTTER + 2 * BORDER);
    const ctx = canvas.getContext("2d");

    ctx.fillStyle = "#1e2124";
    ctx.fillRect(0, 0, WIDTH + 2 * BORDER, HEIGHT + 2 * GUTTER + 2 * BORDER);

    const GREY_COLORS = ["#171e22", "#212b31"]; // TODO: better colours
    const OVERBUDGET_COLORS = ["#D22B2B", "#C41E3A"];
    const UNDERBUDGET_COLORS = ["#32CD32", "#4CBB17"];

    ctx.fillStyle = "rgba(255, 255, 255, 1)";

    const max_fd = Math.max(...hist.map((p) => p.f / (p.endValue - p.startValue)));
    const valueRange = hist[hist.length - 1].endValue - hist[0].startValue;
    console.log(valueRange);
    for (let i = 0; i < hist.length; i++) {
        const bucket = hist[i];
        const cw = bucket.endValue - bucket.startValue;
        const fd = bucket.f / cw;

        const x = bucket.startValue - hist[0].startValue;

        // background
        ctx.fillStyle = GREY_COLORS[i % GREY_COLORS.length];
        ctx.fillRect(
            WIDTH * (1 - x / valueRange),
            GUTTER + BORDER,
            WIDTH * (cw / valueRange),
            HEIGHT
        );

        if (levelBudget) {
            if (x + cw < levelBudget)
                ctx.fillStyle = UNDERBUDGET_COLORS[i % UNDERBUDGET_COLORS.length];
            else ctx.fillStyle = OVERBUDGET_COLORS[i % OVERBUDGET_COLORS.length];
        } else {
            ctx.fillStyle = "white"; // FIXME: choose colour
        }

        // bar
        ctx.fillRect(
            WIDTH * (1 - x / valueRange),
            GUTTER + BORDER + HEIGHT * (1 - (y_scale * fd) / max_fd),
            WIDTH * (cw / valueRange),
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

    if (userScore) {
        userScore = Math.max(
            hist[0].startValue,
            Math.min(hist[hist.length - 1].endValue, userScore)
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
        const line2 = `Top ${userPercentile}%`;

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
