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
    let prevValidBucket: LevelBucket | null = null;
    for (let i = 0; i < buckets.length; i++) {
        const bucket = buckets[i];
        if (bucket) {
            // bucket exists, add and move on
            prevValidBucket = bucket;
            result.push(bucket);
        } else {
            // we began a n length streak of null buckets, we need to fix them.
            const startBucket = prevValidBucket ?? {
                startRank: 0,
                endRank: 0,
                startValue: 0,
                endValue: 0,
            };
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
