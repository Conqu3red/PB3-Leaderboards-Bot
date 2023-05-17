import { Leaderboard, LeaderboardEntry } from "./LeaderboardInterface";
import { CanvasTable, CTConfig, CTData, CTColumn, CTTableDimensions } from "canvas-table";
import { Canvas, createCanvas } from "canvas";
import { N_ENTRIES } from "./Consts";

/* export function cropCanvas(canvas: Canvas, pos: CTTableDimensions, devicePixelRatio: number) {
    const p = {
        x: 0,
        y: 0,
        width: pos.width * devicePixelRatio,
        height: pos.height * devicePixelRatio,
    };
    const ctx = canvas.getContext("2d");
    const data = ctx.getImageData(p.x, p.y, p.width, p.height);

    canvas.width = p.width;
    canvas.height = p.height;
    ctx.clearRect(0, 0, p.width, p.height);
    ctx.putImageData(data, 0, 0);
} */

export const BOARD_DIMENSIONS: [width: number, height: number] = [300, 350];

export interface BoardDetails {
    label?: string;
    entries: LeaderboardEntry[];
}

export async function renderBoardCanvas(board: BoardDetails, index: number): Promise<Canvas> {
    const canvas = createCanvas(...BOARD_DIMENSIONS);

    const columns: CTColumn[] = [
        { title: "#", options: { color: "#ffffff", textAlign: "right" } },
        { title: "Name", options: { color: "#ffffff", maxWidth: 150 } },
        { title: "Score", options: { color: "#ffffff", textAlign: "right" } },
        { title: "Breaks", options: { color: "#ffffff" } },
    ];

    let page_index = Math.floor(index / N_ENTRIES);
    let chosen_entries = board.entries.slice(page_index * N_ENTRIES, (page_index + 1) * N_ENTRIES);

    const data: CTData = chosen_entries.map((entry) => [
        entry.rank.toString(),
        entry.owner.display_name,
        `$${entry.score.toLocaleString("en-US")}`,
        entry.didBreak ? "✱" : "",
    ]);

    // fit: true
    const config: CTConfig = {
        columns,
        data,
        options: {
            title: board.label
                ? { text: board.label, textAlign: "center", color: "#ffffff" }
                : undefined,
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

export async function renderBoard(board: BoardDetails, index: number): Promise<Buffer> {
    const canvas = await renderBoardCanvas(board, index);
    return canvas.toBuffer();
}

export async function renderBoardComparison(
    board1: BoardDetails,
    board2: BoardDetails,
    index: number
): Promise<Buffer> {
    const c1 = await renderBoardCanvas(board1, index);
    const c2 = await renderBoardCanvas(board2, index);

    const cMerged = createCanvas(BOARD_DIMENSIONS[0] * 4, BOARD_DIMENSIONS[1] * 2);
    const ctx = cMerged.getContext("2d");
    //console.log(c1.width, c1.height);
    ctx.drawImage(c1, 0, 0);
    ctx.drawImage(c2, BOARD_DIMENSIONS[0] * 2, 0);

    return cMerged.toBuffer();
}
