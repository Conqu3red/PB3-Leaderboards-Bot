declare module "@doctormckay/steam-webapi" {
    export = SteamWebAPI;

    declare class SteamWebAPI {
        constructor(key?: string, localAddress?: string);

        get(
            iface: string,
            method: string,
            version: number,
            input: object,
            callback: (err: Error | null, response: object) => void
        ): void;
    }
}

declare module "steam-user/components/03-messages";

declare module "steam-user/components/helpers" {
    function eresultError(error: number): Error;
}

declare module "steam-user/protobufs/generated/_load" {
    const CMsgClientLBSFindOrCreateLB;
    const CMsgClientLBSFindOrCreateLBResponse;
    const CMsgClientLBSGetLBEntries;
    const CMsgClientLBSGetLBEntriesResponse;
}
