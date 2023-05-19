import { LeaderboardEntry, LeaderboardType } from "./LeaderboardInterface";
import { pickUserFilter } from "./bot/utils/pickUserFilter";
import { BaseLevel } from "./resources/Level";
import { UserFilter, matchesUserFilter } from "./utils/userFilter";

export interface LabledScore {
    compactName: string;
    score: LeaderboardEntry;
}

export interface FoundUser {
    steam_id_user: string;
    compactName: string;
    type: LeaderboardType;
    score: LeaderboardEntry;
}

export async function findAllUsersWithUsernameOnLevel(
    level: BaseLevel<any>,
    username: string
): Promise<Map<string, FoundUser>> {
    username = username.toLowerCase();
    let users: Map<string, FoundUser> = new Map();

    const userFilter: UserFilter = { by: "display_name", value: username.toLowerCase() };

    for (const type of ["any", "unbroken", "stress"]) {
        const board = level.get(type as LeaderboardType);
        for (const entry of board.top1000) {
            if (matchesUserFilter(userFilter, entry.steam_id_user)) {
                if (users.has(entry.steam_id_user)) continue;
                users.set(entry.steam_id_user, {
                    steam_id_user: entry.steam_id_user,
                    score: entry,
                    compactName: level.compactName(),
                    type: type as LeaderboardType,
                });
            }
        }
    }

    return users;
}

export async function findAllUsersWithUsername(
    levels: BaseLevel<any>[],
    username: string
): Promise<FoundUser[]> {
    let users: Map<string, FoundUser> = new Map();
    for (const level of levels) {
        const partialMap = await findAllUsersWithUsernameOnLevel(level, username);
        for (const [id, entry] of partialMap.entries()) {
            if (!users.has(id)) users.set(id, entry);
        }
    }
    return [...users.values()];
}
