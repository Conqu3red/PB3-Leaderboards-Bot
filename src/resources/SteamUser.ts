import SteamWebAPI from "@doctormckay/steam-webapi";
import { ExpandedSteamUser } from "./Steam";

export const steamAPI = new SteamWebAPI();

export const steamUser = new ExpandedSteamUser({ dataDirectory: ".", autoRelogin: true });
