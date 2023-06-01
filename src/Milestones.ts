import { Canvas, createCanvas } from "canvas";
import { CanvasTable, CTColumn, CTConfig, CTData } from "canvas-table";
import { LeaderboardType } from "./LeaderboardInterface";
import { campaignBuckets, LevelBucket } from "./resources/Buckets";
import { CampaignLevel } from "./resources/CampaignLevel";

export interface BucketResult {
    percentile: number;
    interpolatedRank: number;
}

export function getPercentile(score: number, buckets: LevelBucket): number {
    let total = 0;
    for (let i = 0; i < buckets.count.length; i++) {
        total += buckets.count[i];
    }

    let count = 0;
    for (let i = 0; i < buckets.start.length; i++) {
        if (i == 0 && score < buckets.start[i]) {
            return 1;
        }
        if (score >= buckets.start[i] && score <= buckets.end[i]) {
            if (buckets.end[i] == buckets.start[i]) {
                return count;
            }
            const amountThroughValues =
                (score - buckets.start[i]) / (buckets.end[i] - buckets.start[i]);
            return Math.round(
                count +
                    (100 * buckets.count[i] * Math.max(Math.min(amountThroughValues, 1), 0)) / total
            );
        }
        count += 100 * (buckets.count[i] / total);
    }
    return count;
}

export function getInterpolatedRank(score: number, buckets: LevelBucket): number {
    let count = 0;
    for (let i = 0; i < buckets.start.length; i++) {
        if (i == 0 && score < buckets.start[i]) {
            return 1;
        }
        if (score >= buckets.start[i] && score <= buckets.end[i]) {
            if (buckets.end[i] == buckets.start[i]) {
                return count;
            }
            const amountThroughValues =
                (score - buckets.start[i]) / (buckets.end[i] - buckets.start[i]);
            return Math.round(
                count + buckets.count[i] * Math.max(Math.min(amountThroughValues, 1), 0)
            );
        }
        count += buckets.count[i];
    }
    return count;
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

    return {
        interpolatedRank: getInterpolatedRank(score, levelBuckets[type]),
        percentile: getPercentile(score, levelBuckets[type]),
    };
}
