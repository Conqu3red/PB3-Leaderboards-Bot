import { Canvas, createCanvas } from "canvas";
import { CanvasTable, CTColumn, CTConfig, CTData } from "canvas-table";
import { User } from "discord.js";
import { DateTime } from "luxon";
import { N_ENTRIES } from "./Consts";
import { LeaderboardType, OldestEntry } from "./LeaderboardInterface";
import { LevelCode, levelCodeEqual } from "./LevelCode";
import { cacheManager } from "./resources/CacheManager";
import { matchesUserFilter, UserFilter } from "./utils/userFilter";
import SteamUsernames from "./resources/SteamUsernameHandler";

export interface RecentEntry extends OldestEntry {
    compactName: string;
}

export interface RecentFilters {
    userFilter?: UserFilter;
    levelCode?: LevelCode;
}

export async function getRecent(
    type: LeaderboardType,
    filters: RecentFilters
): Promise<RecentEntry[]> {
    let entries: RecentEntry[] = [];

    for (const level of cacheManager.campaignManager.campaignLevels) {
        if (filters.levelCode && !levelCodeEqual(level.info.code, filters.levelCode)) continue;

        const history = level.getHistory(type);
        entries = entries.concat(
            history
                .filter(
                    (entry) =>
                        !entry.cheated &&
                        (!filters.userFilter ||
                            matchesUserFilter(filters.userFilter, entry.steam_id_user))
                )
                .map((entry) => {
                    return { ...entry, compactName: level.compactName() };
                }) ?? []
        );
    }

    return entries.sort((a, b) => {
        if (b.time < a.time) {
            return -1;
        } else if (b.time === a.time) {
            return a.rank - b.rank;
        } else {
            return 1;
        }
    });
}

export const BOARD_DIMENSIONS: [width: number, height: number] = [350, 350];

export async function renderRecentCanvas(board: RecentEntry[], index: number): Promise<Canvas> {
    const canvas = createCanvas(...BOARD_DIMENSIONS);

    const columns: CTColumn[] = [
        { title: "#", options: { color: "#ffffff", textAlign: "right" } },
        { title: "Level", options: { color: "#ffffff" } },
        { title: "Name", options: { color: "#ffffff", maxWidth: 150 } },
        { title: "Time", options: { color: "#ffffff", textAlign: "right" } },
        { title: "Breaks", options: { color: "#ffffff" } },
    ];

    let page_index = Math.floor(index / N_ENTRIES);
    let chosen_entries = board.slice(page_index * N_ENTRIES, (page_index + 1) * N_ENTRIES);

    const now = DateTime.now();

    const data: CTData = chosen_entries.map((entry) => [
        entry.rank.toString(),
        entry.compactName,
        SteamUsernames.get(entry.steam_id_user),
        DateTime.fromSeconds(entry.time).toRelative({
            base: now,
            style: "short",
            unit: ["days", "hours", "minutes", "seconds"],
        }) ?? "",
        entry.didBreak ? "✱" : "",
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

export async function renderRecent(board: RecentEntry[], index: number): Promise<Buffer> {
    const canvas = await renderRecentCanvas(board, index);
    return canvas.toBuffer();
}
