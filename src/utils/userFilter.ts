import { Remote } from "../RemoteLeaderboardInterface";

export interface UserFilter {
    matches: (user: Remote.User) => boolean;
}

export function userMatchesUsername(name: string): UserFilter {
    name = name.toLowerCase();
    return { matches: (user) => user.display_name.toLowerCase() === name };
}

export function userMatchesID(id: string): UserFilter {
    return { matches: (user) => user.id === id };
}
