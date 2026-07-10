
import { Canvas, createCanvas } from "canvas";
import { CanvasTable, CTColumn, CTConfig, CTData } from "canvas-table";
import { DateTime } from "luxon";
import { N_ENTRIES } from "./Consts";
import { LeaderboardEntry, LeaderboardType, OldestEntry } from "./LeaderboardInterface";
import { LevelCode, levelCodeEqual } from "./LevelCode";
import { cacheManager } from "./resources/CacheManager";
import { matchesUserFilter, UserFilter } from "./utils/userFilter";
import SteamUsernames from "./resources/SteamUsernameHandler";
import { BaseLevel } from "./resources/Level";
import { FormatScore } from "./utils/Format";

export interface NewScore {
    level: BaseLevel;
    type: LeaderboardType;
    oldScore: LeaderboardEntry | undefined;
    newScore: LeaderboardEntry;
}

export const BOARD_DIMENSIONS: [width: number, height: number] = [600, 350];

export async function renderNewScoreCanvas(entries: NewScore[]): Promise<Canvas> {
    // Expects board to contain at most `N_ENTRIES` scores.
    const canvas = createCanvas(...BOARD_DIMENSIONS);

    const columns: CTColumn[] = [
        { title: "Level", options: { color: "#ffffff" } },
        { title: "Board", options: { color: "#ffffff" } },
        { title: "Old Name", options: { color: "#ffffff", maxWidth: 150 } },
        { title: "Old Score", options: { color: "#ffffff", textAlign: "right" } },
        { title: "New Name", options: { color: "#ffffff", maxWidth: 150 } },
        { title: "New Score", options: { color: "#ffffff", textAlign: "right" } },
    ];


    const data: CTData = entries.map((entry) => [
        entry.level.compactName(),
        entry.type,
        entry.oldScore ? SteamUsernames.get(entry.oldScore.steam_id_user) : "-",
        entry.oldScore ? FormatScore(entry.oldScore.score, entry.type) : "-",
        SteamUsernames.get(entry.newScore.steam_id_user),
        FormatScore(entry.newScore.score, entry.type)
    ]);

    // fit: true
    const config: CTConfig = {
        columns,
        data,
        options: {
            background: "#1e2124",
            header: {
                color: "#ffffff",
            },
            fit: true,
            fader: undefined,
            padding: {
                top: 10,
                bottom: 10,
                left: 10,
                right: 10,
            },
        },
    };
    const ct = new CanvasTable(canvas, config);
    await ct.generateTable();
    return canvas;
}

export async function renderNewScore(board: NewScore[]): Promise<Buffer> {
    const canvas = await renderNewScoreCanvas(board);
    return canvas.toBuffer();
}
