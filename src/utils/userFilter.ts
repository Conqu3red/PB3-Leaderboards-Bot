import { Remote } from "../RemoteLeaderboardInterface";

export type FilterType = "display_name" | "id";

export interface UserFilter {
    by: FilterType;
    value: string;
}

export function matchesUserFilter(filter: UserFilter, user: Remote.User): boolean {
    switch (filter.by) {
        case "display_name":
            return user.display_name.toLowerCase() === filter.value.toLowerCase();
        case "id":
            return user.id === filter.value;
    }
}

export function userMatchesUsername(name: string): UserFilter {
    name = name.toLowerCase();
    return { by: "display_name", value: name };
}

export function userMatchesID(id: string): UserFilter {
    return { by: "id", value: id };
}
