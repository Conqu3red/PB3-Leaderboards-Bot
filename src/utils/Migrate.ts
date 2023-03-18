import fs from "fs";
import { loadCampaignLevelInfos } from "../resources/CampaignIndex";
import { LeaderboardEntry, OldestEntry } from "../LeaderboardInterface";
import { DateTime } from "luxon";
import database from "../resources/Lmdb";
import { LevelCode, levelCodeEqual } from "../LevelCode";

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

function mergeHistory(existing_entries: OldestEntry[], new_entries: OldestEntry[]) {
    let entries = existing_entries.concat(new_entries);
    entries.sort((a, b) => a.time - b.time);
    let entries_unique: OldestEntry[] = [];
    let entry_keys: Set<string> = new Set();

    for (const entry of entries) {
        const key = `${entry.didBreak} ${entry.value} ${entry.owner.id}`;
        if (!entry_keys.has(key)) {
            entry_keys.add(key);
            entries_unique.push(entry);
        } else {
            /* console.log(
                `  [-] Removed duplicate score $${entry.value} - ${entry.owner.display_name}`
            ); */
        }
    }

    return entries_unique;
}

async function migrate() {
    const infos = await loadCampaignLevelInfos();
    for (const level of infos) {
        const code = `${level.code.isBonus ? "B" : ""}${level.code.world}-${level.code.level}${
            level.code.isChallenge ? "c" : ""
        }`;
        const filename = `./data/oldest_data_${code}.json`;
        const exists = fs.existsSync(filename);
        if (exists) console.log("[Merge]", code);

        const data: Data = exists
            ? JSON.parse(fs.readFileSync(filename, "utf8"))
            : { any: [], unbroken: [] };
        const anyNew = convertTimes(data.any);
        const anyExisting: OldestEntry[] = database.get(`${level.id}:any:history`) ?? [];
        await database.put(`${level.id}:any:history`, mergeHistory(anyExisting, anyNew));

        const unbrokenNew = convertTimes(data.unbroken);
        const unbrokenExisting: OldestEntry[] = database.get(`${level.id}:unbroken:history`) ?? [];
        await database.put(
            `${level.id}:unbroken:history`,
            mergeHistory(unbrokenExisting, unbrokenNew)
        );
        if (!exists) {
            console.log("[Missing]", code);
        }
    }
}

migrate().then(() => database.close());
