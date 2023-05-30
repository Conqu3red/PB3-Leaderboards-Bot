import SteamUser from "steam-user";
import SteamUserMessages from "steam-user/components/03-messages";
import Helpers from "steam-user/components/helpers";
import Schema from "steam-user/protobufs/generated/_load";
import ByteBuffer from "bytebuffer";
import SteamWebAPI from "@doctormckay/steam-webapi";
import { APP_ID } from "./Consts";

export type ApiCallback = (body: object | Buffer | ByteBuffer) => void;

interface ClientLBSFindOrCreateLB {
    app_id: number;
    leaderboard_sort_method?: SteamUser.ELeaderboardSortMethod;
    leaderboard_display_type?: SteamUser.ELeaderboardDisplayType;
    create_if_not_found: boolean;
    leaderboard_name: string;
}

export interface ClientLBSFindOrCreateLBResponse {
    eresult: number;
    leaderboard_id: number;
    leaderboard_entry_count: number;
    leaderboard_sort_method: number; //SteamUser.ELeaderboardSortMethod;
    leaderboard_display_type: number; // SteamUser.ELeaderboardDisplayType;
    leaderboard_name: string;
}

interface ClientLBSGetLBEntries {
    app_id: number;
    leaderboard_id: number;
    range_start: number;
    range_end: number;
    leaderboard_data_request: SteamUser.ELeaderboardDataRequest;
    steamids: string[];
}

export interface LBEntry {
    steam_id_user: string;
    global_rank: number;
    score: number;
    details: Buffer | null;
    ugc_id?: string;
}

export interface ClientLBSGetLBEntriesResponse {
    eresult: number;
    leaderboard_entry_count: number;
    entries: LBEntry[];
}

interface ProtoHeader {
    msg: number;
    proto: object;
}

export class ExpandedSteamUser extends SteamUser {
    send(
        emsgOrHeader: number | ProtoHeader,
        body: object | Buffer | ByteBuffer,
        callback: ApiCallback
    ) {
        // @ts-expect-error
        this._send(emsgOrHeader, body, callback);
    }

    customSend<RequestType>(
        emsgOrHeader: number | ProtoHeader,
        body: RequestType,
        proto: any,
        callback: ApiCallback
    ) {
        this.send(emsgOrHeader, proto.encode(body).finish(), callback);
    }

    decode<ResponseType>(proto: any, encoded: object | Buffer | ByteBuffer): ResponseType {
        return SteamUserMessages._decodeProto(proto, encoded);
    }

    GetLeaderboard(name: string): Promise<ClientLBSFindOrCreateLBResponse> {
        return new Promise((resolve, reject) => {
            this.customSend<ClientLBSFindOrCreateLB>(
                {
                    msg: SteamUser.EMsg.ClientLBSFindOrCreateLB,
                    proto: {
                        routing_appid: APP_ID,
                    },
                },
                {
                    app_id: APP_ID,
                    leaderboard_name: name,
                    create_if_not_found: false,
                },
                Schema.CMsgClientLBSFindOrCreateLB,
                (body) => {
                    const result = this.decode<ClientLBSFindOrCreateLBResponse>(
                        Schema.CMsgClientLBSFindOrCreateLBResponse,
                        body
                    );

                    if (result.eresult != SteamUser.EResult.OK) {
                        reject(Helpers.eresultError(result.eresult));
                    }

                    resolve(result);
                }
            );
        });
    }

    GetLeaderboardEntries(
        leaderboard_id: number,
        range_start: number,
        range_end: number,
        leaderboard_data_request: SteamUser.ELeaderboardDataRequest,
        steamids?: string[]
    ): Promise<ClientLBSGetLBEntriesResponse> {
        return new Promise((resolve, reject) => {
            this.customSend<ClientLBSGetLBEntries>(
                {
                    msg: SteamUser.EMsg.ClientLBSGetLBEntries,
                    proto: {
                        routing_appid: APP_ID,
                    },
                },
                {
                    app_id: APP_ID,
                    leaderboard_id,
                    range_start,
                    range_end,
                    leaderboard_data_request,
                    steamids: steamids ?? [],
                },
                Schema.CMsgClientLBSGetLBEntries,
                (body) => {
                    const result = this.decode<ClientLBSGetLBEntriesResponse>(
                        Schema.CMsgClientLBSGetLBEntriesResponse,
                        body
                    );
                    if (result.eresult != SteamUser.EResult.OK) {
                        reject(Helpers.eresultError(result.eresult));
                    }

                    resolve(result);
                }
            );
        });
    }
}

export interface Player {
    steamid: string;
    personaname: string;
    profileurl: string;
    avatar: string;
}

export interface UserLookupResult {
    players: Player[];
}

export async function LookupUsers(
    api: SteamWebAPI,
    usernames: string[],
    cellID?: number
): Promise<UserLookupResult> {
    return new Promise((resolve, reject) => {
        api.get(
            "ISteamUser",
            "GetPlayerSummaries",
            2,
            {
                steamids: usernames.join(","),
                cell_id: cellID || 0,
            },
            (err, response) => {
                if (err != null) {
                    reject(err);
                }

                resolve(response as UserLookupResult);
            }
        );
    });
}
