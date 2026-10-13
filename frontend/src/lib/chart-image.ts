import type { SheetChart } from "@/lib/excel";

/**
 * Charts drawn to a PNG for Excel workbooks. ExcelJS can't write native Excel
 * charts, so the chart is a picture — the numbers sit in a table beside it.
 */

export type Bar = { label: string; value: number };

// White, because the image sits on an Excel sheet, which is always light.
const SURFACE = "#ffffff";
const BAR = "#2a78d6";
const TEXT = "#0b0b0b";
const MUTED = "#52514e";
const AXIS = "#d4d4d0";
const FONT = "12px system-ui, -apple-system, 'Segoe UI', 'Noto Sans Khmer', sans-serif";

const WIDTH = 640;
const LABEL_WIDTH = 170;
const VALUE_ROOM = 64;
const PITCH = 28; // one bar plus the air around it
const THICKNESS = 18; // bars stay thin; the rest of the pitch is space
const PAD = 12;
// Drawn at twice the size so it stays sharp when Excel is zoomed in.
const SCALE = 2;

/** Cuts text with an ellipsis so it fits `max` pixels. */
function fit(ctx: CanvasRenderingContext2D, text: string, max: number): string {
  if (ctx.measureText(text).width <= max) return text;
  let cut = text;
  while (cut.length > 1 && ctx.measureText(`${cut}…`).width > max) cut = cut.slice(0, -1);
  return `${cut}…`;
}

/** A horizontal bar chart, one bar per row, values written at the bar tips. */
export function barChartImage(bars: Bar[], format: (value: number) => string = String): SheetChart {
  const height = PAD * 2 + Math.max(bars.length, 1) * PITCH;
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH * SCALE;
  canvas.height = height * SCALE;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(SCALE, SCALE);

  ctx.fillStyle = SURFACE;
  ctx.fillRect(0, 0, WIDTH, height);
  ctx.font = FONT;
  ctx.textBaseline = "middle";

  const max = Math.max(...bars.map((b) => b.value), 0);
  const left = LABEL_WIDTH;
  const span = WIDTH - left - VALUE_ROOM - PAD;

  bars.forEach((bar, i) => {
    const middle = PAD + i * PITCH + PITCH / 2;

    ctx.fillStyle = TEXT;
    ctx.textAlign = "right";
    ctx.fillText(fit(ctx, bar.label, LABEL_WIDTH - 12), left - 8, middle);

    const length = max > 0 ? Math.max((bar.value / max) * span, bar.value > 0 ? 2 : 0) : 0;
    if (length > 0) {
      // Square at the baseline, 4px rounded at the data end.
      ctx.fillStyle = BAR;
      ctx.beginPath();
      ctx.roundRect(left, middle - THICKNESS / 2, length, THICKNESS, [0, 4, 4, 0]);
      ctx.fill();
    }

    ctx.fillStyle = MUTED;
    ctx.textAlign = "left";
    ctx.fillText(format(bar.value), left + length + 6, middle);
  });

  // The shared baseline every bar grows from.
  ctx.strokeStyle = AXIS;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(left + 0.5, PAD);
  ctx.lineTo(left + 0.5, height - PAD);
  ctx.stroke();

  return { png: canvas.toDataURL("image/png"), width: WIDTH, height };
}
