export interface LevelCode {
    world: World;
    level: number;
    challenge: boolean;
}

export const LEVEL_REGEX = /(\w+)-?(\d+)(c?)/i;

export const WORLDS = [
    "1", "2", "3", "4", "5", "6", "B1", "B2", // PB2 Worlds
    "CR", "MM", "RB", "BB", "VT", "LL", "RMT", "SC", "DS", "FD", "TT", "RTA", "AT", "FR" // PB3 Worlds
] as const;

export type World = (typeof WORLDS)[number];

export function isWorld(w: string): w is World {
    return WORLDS.includes(w as World);
}

export function parseLevelCode(code: string): LevelCode | null {
    let match = code.replaceAll(/\s/g, "").match(LEVEL_REGEX);
    if (!match) return null;
    let world = match[1].toUpperCase();
    if (!isWorld(world)) return null;
    let level = parseInt(match[2]);

    if (isNaN(level)) return null;

    return {
        world: world,
        level,
        challenge: match[3].length > 0 
    };
}

export function levelCodeEqual(code: LevelCode, other: LevelCode): boolean {
    return code.world === other.world && code.level === other.level && code.challenge == other.challenge;
}

export function encodeLevelCode(code: LevelCode): string {
    return `${code.world}-${code.level.toString().padStart(2, "0")}${code.challenge ? 'c' : ''}`;
}

export function isSecretWord(code: LevelCode): boolean {
    return code.world === "FR";
}
