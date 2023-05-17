import { LookupUsers } from "../Steam";
import { steamAPI, steamUser } from "../bot/Index";
import Queue from "../utils/Queue";
import { userDB } from "./Lmdb";

export default class SteamUsernames {
    static idsQueued: Set<string> = new Set();
    static idQueue: Queue<string> = new Queue();

    static async reloadGroup() {
        let ids: string[] = [];
        for (let i = 0; i < 100; i++) {
            if (this.idQueue.isEmpty()) break;
            const v = this.idQueue.shift();
            if (v != null) ids.push(v);
        }

        const response = await LookupUsers(steamAPI, ids, steamUser.cellID);

        await userDB.transaction(async () => {
            for (const player of response.players) {
                await userDB.put(player.steamid, player.personaname);
                // TODO: write current time
            }
        });
    }

    static get(steam_id: string): string {
        let username: string | undefined = userDB.get(steam_id);
        return username ?? `<${steam_id}>`;
    }

    static ID_RELOAD_INTERVAL = 100 * 60 * 60 * 1000; // 100 hours
    // FIXME: outdated usernames need to be updated
}
