import { Leaderboard } from "./LeaderboardInterface";
import { CanvasTable, CTConfig, CTData, CTColumn, CTTableDimensions } from "canvas-table";
import { createCanvas } from "canvas";
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

export async function renderBoard(board: Leaderboard, index: number): Promise<Buffer> {
    const canvas = createCanvas(300, 350);

    const columns: CTColumn[] = [
        { title: "#", options: { color: "#ffffff", textAlign: "right" } },
        { title: "Name", options: { color: "#ffffff", maxWidth: 150 } },
        { title: "Score", options: { color: "#ffffff", textAlign: "right" } },
        { title: "Breaks", options: { color: "#ffffff" } },
    ];

    let page_index = Math.floor(index / N_ENTRIES);
    let chosen_entries = board.top1000.slice(page_index * N_ENTRIES, (page_index + 1) * N_ENTRIES);

    const data: CTData = chosen_entries.map((entry) => [
        entry.rank.toString(),
        entry.owner.display_name,
        `$${entry.value}`,
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
    return await ct.renderToBuffer();
}
