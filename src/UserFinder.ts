import { LeaderboardEntry } from "./LeaderboardInterface";
import { Remote } from "./RemoteLeaderboardInterface";
import { BaseLevel } from "./resources/Level";

export interface LabledScore {
    compactName: string;
    score: LeaderboardEntry;
}

export interface FoundUser {
    user: Remote.User;
    score: LabledScore;
}

export async function findAllUsersWithUsernameOnLevel(
    level: BaseLevel<any>,
    username: string
): Promise<Map<string, FoundUser>> {
    username = username.toLowerCase();
    let users: Map<string, FoundUser> = new Map();
    let boards = [level.get(false), level.get(true)];
    let unbroken = false;

    for (const board of boards) {
        for (const entry of board.top1000) {
            if (entry.owner.display_name.toLocaleLowerCase() === username) {
                users.set(entry.owner.id, {
                    user: entry.owner,
                    score: {
                        score: entry,
                        compactName: level.compactName() + (unbroken ? " (unbroken)" : ""),
                    },
                });
            }
        }
        unbroken = true;
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
