import fs from "fs";
import { loadCampaignLevelInfos } from "../resources/CampaignIndex";
import { LeaderboardEntry, OldestEntry } from "../LeaderboardInterface";
import { DateTime } from "luxon";
import database from "../resources/Lmdb";

const TIME_FORMAT = "dd/MM/yy-hh:mm";

interface Data {
    any: Entry[];
    unbroken: Entry[];
}

interface Entry extends LeaderboardEntry {
    time: string;
}

function convertTimes(data: Entry[]): OldestEntry[] {
    return data.map((entry) => {
        return {
            ...entry,
            time: DateTime.fromFormat(entry.time, TIME_FORMAT).toSeconds(),
            cheated: false,
        };
    });
}

async function migrate() {
    const infos = await loadCampaignLevelInfos();
    for (const level of infos) {
        const code = `${level.code.world}-${level.code.level}${level.code.isChallenge ? "c" : ""}`;
        const filename = `./data/oldest_data_${code}.json`;
        if (fs.existsSync(filename)) {
            console.log("[Merge]", code);

            const data: Data = JSON.parse(fs.readFileSync(filename, "utf8"));
            const anyNew = convertTimes(data.any);
            await database.put(`${level.id}:any:history`, anyNew);

            const unbrokenNew = convertTimes(data.unbroken);
            await database.put(`${level.id}:unbroken:history`, unbrokenNew);
        }
    }
}

migrate();
