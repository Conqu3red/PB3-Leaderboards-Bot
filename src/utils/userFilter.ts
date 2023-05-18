import SteamUsernames from "../resources/SteamUsernameHandler";

export type FilterType = "display_name" | "id";

export interface UserFilter {
    by: FilterType;
    value: string;
}

export function matchesUserFilter(filter: UserFilter, steam_id: string): boolean {
    switch (filter.by) {
        case "display_name":
            return SteamUsernames.get(steam_id).toLowerCase() === filter.value.toLowerCase();
        case "id":
            return steam_id === filter.value;
    }
}

export function userMatchesUsername(name: string): UserFilter {
    name = name.toLowerCase();
    return { by: "display_name", value: name };
}

export function userMatchesID(id: string): UserFilter {
    return { by: "id", value: id };
}
