export interface LevelCode {
    world: string;
    level: number;
}

export const LEVEL_REGEX = /(CR|MM|RB|BB|VT|LL|RMT|SC|DS|TT)-(\d+)/i;

export function parseLevelCode(code: string): LevelCode | null {
    let match = code.match(LEVEL_REGEX);
    if (!match) return null;
    let world = match[1];
    let level = parseInt(match[2]);

    if (isNaN(level)) return null;

    return {
        world,
        level,
    };
}

export function levelCodeEqual(code: LevelCode, other: LevelCode): boolean {
    return code.world === other.world && code.level === other.level;
}

export function encodeLevelCode(code: LevelCode): string {
    return `${code.world}-${code.level.toString().padStart(2, "0")}`;
}
