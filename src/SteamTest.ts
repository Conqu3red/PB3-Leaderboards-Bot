import SteamWebAPI from "@doctormckay/steam-webapi";
import { ExpandedSteamUser, LookupUsers } from "./Steam";

require("dotenv").config();
const { STEAM_WEBAPI_KEY, STEAM_USERNAME, STEAM_PASSWORD } = process.env;

var api = new SteamWebAPI(STEAM_WEBAPI_KEY);

var user = new ExpandedSteamUser({
    dataDirectory: ".",
});

user.logOn({
    accountName: STEAM_USERNAME,
    password: STEAM_PASSWORD,
});

user.on("loggedOn", async (details) => {
    console.log("Logged in!");
    console.log(details);

    await new Promise((resolve) => setTimeout(resolve, 2000));

    let r = await user.GetLeaderboard("014");
    console.log(r);

    let entryResult = await user.GetLeaderboardEntries(
        r.leaderboard_id,
        0,
        1000,
        ExpandedSteamUser.ELeaderboardDataRequest.Global
    );
    console.log(entryResult);

    // TODO: batch into groups of 100
    let userResult = await LookupUsers(
        api,
        entryResult.entries.map((entry) => entry.steam_id_user),
        user.cellID
    );
    //console.log(userResult);

    let idToNames = new Map();
    for (const user of userResult.players) {
        idToNames.set(user.steamid, user.personaname);
    }

    for (const entry of entryResult.entries) {
        console.log(
            entry.global_rank,
            idToNames.get(entry.steam_id_user),
            entry.score,
            entry.details != null && entry.details.readUInt32LE(0) != 0 ? "*" : ""
        );
    }

    user.logOff();
});
