export interface LevelCode {
    world: number;
    level: number;
    isChallenge: boolean;
    isBonus: boolean;
}

export const LEVEL_REGEX = /([Bb]?)(\d+)-(\d+)([Cc]?)/;

export function parseLevelCode(code: string): LevelCode | null {
    let match = code.match(LEVEL_REGEX);
    if (!match) return null;
    let isBonus = match[1].length == 1;
    let world = parseInt(match[2]);
    let level = parseInt(match[3]);
    let isChallenge = match[4].length == 1;

    if (isNaN(world) || isNaN(level)) return null;

    return {
        world,
        level,
        isChallenge,
        isBonus,
    };
}

export function levelCodeEqual(code: LevelCode, other: LevelCode): boolean {
    return (
        code.world === other.world &&
        code.level === other.level &&
        code.isChallenge === other.isChallenge &&
        code.isBonus === other.isBonus
    );
}

export function encodeLevelCode(code: LevelCode): string {
    const bonus = code.isBonus ? "B" : "";
    const challenge = code.isChallenge ? "c" : "";
    return `${bonus}${code.world}-${code.level.toString().padStart(2, "0")}${challenge}`;
}
