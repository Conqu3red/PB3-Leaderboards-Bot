export interface LevelCode {
    world: number;
    level: number;
    isChallenge: boolean;
}

export function parseLevelCode(code: string): LevelCode | null {
    let parts = code.toLocaleLowerCase().split("-");
    if (parts.length != 2) return null;
    let [p1, p2] = parts;
    let world = parseInt(p1);
    let isChallenge = p2.endsWith("c");
    if (isChallenge) p2 = p2.slice(0, p2.length - 1);
    let level = parseInt(p2);

    if (isNaN(world) || isNaN(level)) return null;

    return {
        world,
        level,
        isChallenge,
    };
}

export function levelCodeEqual(code: LevelCode, other: LevelCode): boolean {
    return (
        code.world == other.world &&
        code.level == other.level &&
        code.isChallenge == other.isChallenge
    );
}

export function encodeLevelCode(code: LevelCode): string {
    return `${code.world}-${code.level.toString().padStart(2, "0")}${code.isChallenge ? "c" : ""}`;
}
