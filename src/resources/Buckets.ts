import { Parser } from "binary-parser";
import { SimpleResource } from "./RemoteResource";

export const BUCKETS_PER_ARRAY = 20; // Taken from the PB3 code.

interface CampaignBuckets {
    [key: string]: LevelBuckets | undefined;
}

export interface LevelBuckets {
    any: LevelBucket;
    unbreaking: LevelBucket;
    stress: LevelBucket;
}

export interface LevelBucket {
    start: number[];
    end: number[];
    count: number[];
}

export function LevelBucketCreate(): LevelBucket {
    return {
        start: new Array(BUCKETS_PER_ARRAY).fill(0),
        end: new Array(BUCKETS_PER_ARRAY).fill(0),
        count: new Array(BUCKETS_PER_ARRAY).fill(0),
    };
}

const typeParser = Parser.start().endianness("little").int32("start").int32("end").int32("count");

const bucketParser = Parser.start()
    .endianness("little")
    .uint16("length")
    .string("id", {
        encoding: "utf8",
        length: "length",
    })
    .int32("bucketIndex", { formatter: (item) => item - 1 })
    .nest("any", { type: typeParser })
    .nest("unbreaking", { type: typeParser })
    .nest("stress", { type: typeParser });

const levelBucketsParser = Parser.start().endianness("little").array("buckets", {
    type: bucketParser,
    readUntil: "eof",
});

export const campaignBuckets = new SimpleResource<CampaignBuckets, ArrayBuffer>(
    30 * 60 * 1000, // 30 minutes
    "collated.json",
    "buckets/campaign.bin",
    {},
    async (remote) => {
        const buf = Buffer.from(remote);
        const parsed = levelBucketsParser.parse(buf);
        let levels: CampaignBuckets = {};
        for (const bucket of parsed.buckets) {
            if (!levels[bucket.id]) {
                levels[bucket.id] = {
                    any: LevelBucketCreate(),
                    unbreaking: LevelBucketCreate(),
                    stress: LevelBucketCreate(),
                };
            }
            const buckets = levels[bucket.id];
            if (bucket.bucketIndex >= 0 && bucket.bucketIndex < BUCKETS_PER_ARRAY && buckets) {
                const n = bucket.bucketIndex;
                buckets.any.start[n] = bucket.any.start;
                buckets.any.end[n] = bucket.any.end;
                buckets.any.count[n] = bucket.any.count;
                buckets.unbreaking.start[n] = bucket.unbreaking.start;
                buckets.unbreaking.end[n] = bucket.unbreaking.end;
                buckets.unbreaking.count[n] = bucket.unbreaking.count;
                buckets.stress.start[n] = bucket.stress.start;
                buckets.stress.end[n] = bucket.stress.end;
                buckets.stress.count[n] = bucket.stress.count;
            }
        }
        return levels;
    },
    { responseType: "arraybuffer" }
);
