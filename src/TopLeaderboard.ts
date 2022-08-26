import { Leaderboard } from "./LeaderboardInterface";
import { CanvasTable, CTConfig, CTData, CTColumn, CTTableDimensions } from "canvas-table";
import { createCanvas } from "canvas";

const N_ENTRIES = 12;

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

export async function renderBoard(board: Leaderboard, index: number) {
    const canvas = createCanvas(250, 350);

    const columns: CTColumn[] = [
        { title: "#", options: { color: "#ffffff", textAlign: "right" } },
        { title: "Name", options: { color: "#ffffff" } },
        { title: "Score", options: { color: "#ffffff", textAlign: "right" } },
        { title: "Breaks", options: { color: "#ffffff" } },
    ];

    let page_index = index % N_ENTRIES;
    let chosen_entries = board.top1000.slice(page_index, page_index + 12);

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
                top: 20,
                bottom: 20,
                left: 20,
                right: 20,
            },
        },
    };
    const ct = new CanvasTable(canvas, config);
    await ct.generateTable();
    await ct.renderToFile("test-table.png");
}
