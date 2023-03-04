import { Parser } from "binary-parser";
import { SimpleResource } from "./RemoteResource";

interface CampaignBuckets {
    [key: string]: LevelBuckets | undefined;
}

export interface LevelBuckets {
    any: (LevelBucket | null)[];
    unbroken: (LevelBucket | null)[];
}

export interface LevelBucket {
    startRank: number;
    endRank: number;
    startValue: number;
    endValue: number;
}

const bucketParser = Parser.start()
    .endianness("little")
    .int32("startRank")
    .choice({
        tag: "startRank",
        choices: {
            "-1": Parser.start(),
        },
        defaultChoice: Parser.start()
            .endianness("little")
            .int32("endRank")
            .int32("startValue")
            .int32("endValue"),
    });

const levelBucketsParser = Parser.start()
    .endianness("little")
    .string("id", {
        encoding: "utf8",
        length: 5,
    })
    .array("any", {
        type: bucketParser,
        length: 100,
    })
    .array("unbroken", {
        type: bucketParser,
        length: 100,
    });

const campaignBucketsParser = Parser.start()
    .endianness("little")
    .array("levelBuckets", {
        type: levelBucketsParser,
        readUntil: function (item, buffer) {
            return buffer.readUInt8() == 10;
        },
    });

export const campaignBuckets = new SimpleResource<CampaignBuckets, ArrayBuffer>(
    8 * 60 * 60 * 1000,
    "collated.json",
    "manifests/leaderboards/buckets/collated.bin",
    {},
    async (remote) => {
        const buf = Buffer.from(remote);
        const parsed = campaignBucketsParser.parse(buf);
        let levels: CampaignBuckets = {};
        for (const level of parsed.levelBuckets) {
            levels[level.id] = {
                any: level.any.map((item: any) => (item.startRank == -1 ? null : item)),
                unbroken: level.unbroken.map((item: any) => (item.startRank == -1 ? null : item)),
            };
        }
        return levels;
    },
    { responseType: "arraybuffer" }
);
