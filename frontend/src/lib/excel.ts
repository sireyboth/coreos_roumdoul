import type { Cell, CellValue, Workbook, Worksheet } from "exceljs";
import { saveBlob } from "@/lib/download";

/**
 * Reading and writing real Excel workbooks (.xlsx) in the browser.
 *
 * ExcelJS is large, so it is only downloaded the first time someone actually
 * exports or imports — never as part of loading a page.
 */
async function excel() {
  const mod = await import("exceljs");
  return (mod as unknown as { default?: typeof mod }).default ?? mod;
}

// ───────────────────────────── Writing ─────────────────────────────

export type SheetValue = string | number | boolean | null | undefined;

export type SheetColumn<T> = {
  header: string;
  value: (row: T) => SheetValue;
  /** "date" turns YYYY-MM-DD text into a real Excel date; "number" keeps numbers numeric. */
  type?: "text" | "number" | "date";
  /** Excel number format, e.g. "0.00". */
  format?: string;
  /** Characters; worked out from the content when left out. */
  width?: number;
};

export type SheetSpec<T> = {
  name: string;
  columns: SheetColumn<T>[];
  rows: T[];
};

const HEADER_FILL = "FF1E293B"; // slate-800
const REQUIRED_FILL = "FF4338CA"; // indigo-700 — marks the columns an import can't do without
const BORDER = { style: "thin" as const, color: { argb: "FFE2E8F0" } };

/** Excel forbids these in sheet names, and caps them at 31 characters. */
function sheetName(name: string): string {
  return name.replace(/[\\/?*[\]:]/g, " ").slice(0, 31) || "Sheet1";
}

/** A YYYY-MM-DD string as a date Excel shows the same everywhere (no time zone drift). */
function excelDate(value: string): Date | string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  return m ? new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))) : value;
}

/** Styles row 1 as a header and freezes it — plus the first `xSplit` columns, when given. */
export function styleHeader(sheet: Worksheet, required: Set<number> = new Set(), xSplit = 0) {
  const header = sheet.getRow(1);
  header.height = 22;
  header.eachCell((cell, col) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: required.has(col) ? REQUIRED_FILL : HEADER_FILL } };
    cell.alignment = { vertical: "middle" };
    cell.border = { bottom: BORDER };
  });
  // The header stays in view while scrolling.
  sheet.views = [{ state: "frozen", ySplit: 1, xSplit }];
}

/** A column's value as Excel should store it: real dates and numbers, blanks left empty. */
function cellValue<T>(column: SheetColumn<T>, value: SheetValue): Date | string | number | boolean | null {
  if (value == null || value === "") return null;
  if (column.type === "date" && typeof value === "string") return excelDate(value);
  if (column.type === "number" && typeof value === "string" && value.trim() !== "" && !Number.isNaN(Number(value))) {
    return Number(value);
  }
  return value;
}

function addSheet<T>(workbook: Workbook, spec: SheetSpec<T>) {
  const sheet = workbook.addWorksheet(sheetName(spec.name));
  sheet.addRow(spec.columns.map((c) => c.header));

  const widths = spec.columns.map((c) => c.header.length);

  for (const row of spec.rows) {
    const values = spec.columns.map((column, i) => {
      const value = column.value(row);
      widths[i] = Math.max(widths[i], value == null ? 0 : String(value).length);
      return cellValue(column, value);
    });
    const added = sheet.addRow(values);
    added.eachCell((cell) => (cell.border = { bottom: BORDER }));
  }

  spec.columns.forEach((column, i) => {
    const col = sheet.getColumn(i + 1);
    col.width = column.width ?? Math.min(Math.max(widths[i] + 2, 10), 50);
    if (column.type === "date") col.numFmt = "yyyy-mm-dd";
    if (column.format) col.numFmt = column.format;
  });

  styleHeader(sheet);
  if (spec.rows.length > 0) {
    sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: spec.columns.length } };
  }

  return sheet;
}

async function download(workbook: Workbook, filename: string) {
  const buffer = await workbook.xlsx.writeBuffer();
  saveBlob(
    new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`,
  );
}

async function newWorkbook(): Promise<Workbook> {
  const ExcelJS = await excel();
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Business OS";
  workbook.created = new Date();
  return workbook;
}

/** Builds a one-sheet workbook and hands it to the browser's download bar. */
export async function downloadSheet<T>(filename: string, spec: SheetSpec<T>) {
  const workbook = await newWorkbook();
  addSheet(workbook, spec);
  await download(workbook, filename);
}

/** A chart drawn to a PNG (see chart-image.ts), placed on a sheet at its natural size. */
export type SheetChart = { png: string; width: number; height: number };

/** One titled table on a chart sheet, with an optional chart to its right. */
export type ChartBlock<T> = {
  title: string;
  columns: SheetColumn<T>[];
  rows: T[];
  chart?: SheetChart;
};

export type WorkbookBuilder = {
  sheet<T>(spec: SheetSpec<T>): void;
  /** A sheet of summary tables stacked top to bottom, each with its chart beside it. */
  chartSheet(name: string): { block<T>(block: ChartBlock<T>): void };
  /** A blank sheet the caller lays out cell by cell, for grids the specs above can't describe. */
  worksheet(name: string, build: (sheet: Worksheet) => void): void;
};

// Excel's default row height, in pixels — used to leave room under a chart image.
const ROW_PX = 20;

function addChartSheet(workbook: Workbook, name: string) {
  const sheet = workbook.addWorksheet(sheetName(name), { views: [{ showGridLines: false }] });
  let top = 1;

  return {
    block<T>(block: ChartBlock<T>) {
      const title = sheet.getRow(top).getCell(1);
      title.value = block.title;
      title.font = { bold: true, size: 13 };

      const header = sheet.getRow(top + 1);
      block.columns.forEach((column, i) => {
        const cell = header.getCell(i + 1);
        cell.value = column.header;
        cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_FILL } };
        cell.border = { bottom: BORDER };
      });

      block.rows.forEach((row, r) => {
        const line = sheet.getRow(top + 2 + r);
        block.columns.forEach((column, i) => {
          const cell = line.getCell(i + 1);
          cell.value = cellValue(column, column.value(row));
          cell.border = { bottom: BORDER };
          if (column.format) cell.numFmt = column.format;
        });
      });

      // Blocks share columns, so each column is as wide as its widest block needs.
      block.columns.forEach((column, i) => {
        const col = sheet.getColumn(i + 1);
        const longest = Math.max(column.header.length, ...block.rows.map((row) => String(column.value(row) ?? "").length));
        col.width = Math.max(col.width ?? 0, column.width ?? Math.min(Math.max(longest + 2, 10), 40));
      });

      let used = block.rows.length + 2;
      if (block.chart) {
        const image = workbook.addImage({ base64: block.chart.png, extension: "png" });
        // One empty column between the table and the chart.
        sheet.addImage(image, {
          tl: { col: block.columns.length + 1, row: top - 1 },
          ext: { width: block.chart.width, height: block.chart.height },
        });
        used = Math.max(used, Math.ceil(block.chart.height / ROW_PX));
      }
      top += used + 2;
    },
  };
}

/** Builds a workbook of several sheets and hands it to the browser's download bar. */
export async function downloadWorkbook(filename: string, build: (book: WorkbookBuilder) => void) {
  const workbook = await newWorkbook();
  // ExcelJS doesn't save a formula's cached result of 0, so Excel works every formula out on open.
  workbook.calcProperties.fullCalcOnLoad = true;
  build({
    sheet: (spec) => void addSheet(workbook, spec),
    chartSheet: (name) => addChartSheet(workbook, name),
    worksheet: (name, fill) => fill(workbook.addWorksheet(sheetName(name))),
  });
  await download(workbook, filename);
}

/** Today as YYYY-MM-DD, for file names. */
export function today(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

// ──────────────────────────── Templates ────────────────────────────

export type TemplateColumn = {
  header: string;
  required?: boolean;
  /** What to type — shown on the Instructions sheet. */
  hint: string;
  example?: string;
  /** Offered as a dropdown in the template (typing something else is still allowed). */
  choices?: string[];
};

// Rows that get a dropdown in a template. Plenty for a manual import.
const TEMPLATE_ROWS = 1000;

/**
 * An empty import template: the data sheet first (so it is the one that is
 * read back), then Instructions, then a hidden sheet holding dropdown lists —
 * a list written inline is capped at 255 characters, a sheet range is not.
 */
export async function downloadTemplate(filename: string, title: string, columns: TemplateColumn[], notes: string[] = []) {
  const workbook = await newWorkbook();
  const data = workbook.addWorksheet(sheetName(title));
  const help = workbook.addWorksheet("Instructions");
  const lists = workbook.addWorksheet("Lists", { state: "veryHidden" });

  data.addRow(columns.map((c) => c.header));
  const required = new Set<number>();
  columns.forEach((column, i) => {
    if (column.required) required.add(i + 1);
    data.getColumn(i + 1).width = Math.min(Math.max(column.header.length + 4, (column.example?.length ?? 0) + 2, 14), 40);
    data.getRow(1).getCell(i + 1).note = column.hint;
  });
  styleHeader(data, required);

  let listColumn = 0;
  columns.forEach((column, i) => {
    if (!column.choices?.length) return;
    listColumn++;
    column.choices.forEach((choice, r) => (lists.getRow(r + 1).getCell(listColumn).value = choice));
    const letter = lists.getColumn(listColumn).letter;
    const range = `Lists!$${letter}$1:$${letter}$${column.choices.length}`;

    for (let r = 2; r <= TEMPLATE_ROWS + 1; r++) {
      data.getRow(r).getCell(i + 1).dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: [range],
        // A warning, not a stop: a name typed slightly differently is still matched on import.
        showErrorMessage: true,
        errorStyle: "warning",
        errorTitle: column.header,
        error: "That isn't one of the listed values. Keep it anyway?",
      };
    }
  });

  help.addRow([title]);
  help.getRow(1).font = { bold: true, size: 14 };
  help.addRow([]);
  const steps = [
    "Fill in one row per record on the first sheet. Leave the header row as it is.",
    "Columns with a dark blue header are required. The others can be left blank.",
    "Hover over a header to see what it expects. Columns with a dropdown list the accepted values.",
    "Dates are YYYY-MM-DD (e.g. 2026-09-01) and times are 24-hour HH:MM (e.g. 08:30). Real Excel dates and times work too.",
    "Save the file as an Excel workbook (.xlsx), then upload it on the import screen.",
    ...notes,
  ];
  steps.forEach((step, i) => help.addRow([`${i + 1}.`, step]));
  help.addRow([]);

  const tableStart = help.rowCount + 1;
  help.addRow(["Column", "Required", "What to enter", "Example"]);
  for (const column of columns) {
    help.addRow([column.header, column.required ? "Yes" : "No", column.hint, column.example ?? ""]);
  }
  help.getRow(tableStart).eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_FILL } };
  });
  help.getColumn(1).width = 24;
  help.getColumn(2).width = 10;
  help.getColumn(3).width = 80;
  help.getColumn(4).width = 26;
  help.getColumn(3).alignment = { wrapText: true, vertical: "top" };

  await download(workbook, filename);
}

// ───────────────────────────── Reading ─────────────────────────────

export type SheetRow = {
  /** The row number as Excel shows it, for messages a person can find. */
  rowNumber: number;
  /** Every cell as trimmed text, keyed by the header it sits under. */
  cells: Record<string, string>;
};

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Any cell as plain text. Excel stores dates and times as dates, emails often
 * become hyperlinks, and typed text can be "rich" — all of it is flattened
 * here so the rest of the import only ever deals with strings.
 */
function cellText(value: CellValue): string {
  if (value == null) return "";
  if (value instanceof Date) {
    // ExcelJS reads dates as UTC. Excel's day zero is 1899-12-30, so a bare time lands there.
    const date = `${value.getUTCFullYear()}-${pad(value.getUTCMonth() + 1)}-${pad(value.getUTCDate())}`;
    const time = `${pad(value.getUTCHours())}:${pad(value.getUTCMinutes())}`;
    if (value.getUTCFullYear() <= 1900) return time;
    return time === "00:00" ? date : `${date} ${time}`;
  }
  if (typeof value === "object") {
    if ("richText" in value) return value.richText.map((part) => part.text).join("").trim();
    if ("hyperlink" in value) return cellText(value.text as CellValue);
    if ("formula" in value || "sharedFormula" in value) return cellText((value as { result?: CellValue }).result ?? null);
    if ("error" in value) return "";
    return "";
  }
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value).trim();
}

/** Header text compared loosely: case, spacing and a trailing "*" don't matter. */
export function headerKey(header: string): string {
  return header.replace(/\*/g, "").replace(/\s+/g, " ").trim().toLowerCase();
}

export class WorkbookError extends Error {}

/** Reads the first sheet of an .xlsx file: the first non-empty row is the header. */
export async function readFirstSheet(file: File): Promise<{ headers: string[]; rows: SheetRow[] }> {
  if (!/\.xlsx$/i.test(file.name)) {
    throw new WorkbookError(
      /\.xls$/i.test(file.name)
        ? "That's an old-style .xls file. Open it in Excel and save it as an Excel Workbook (.xlsx) first."
        : "Choose an Excel workbook (.xlsx).",
    );
  }

  const ExcelJS = await excel();
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(await file.arrayBuffer());
  } catch {
    throw new WorkbookError("That file couldn't be opened as an Excel workbook. It may be damaged or password-protected.");
  }

  const sheet = workbook.worksheets.find((s) => s.state !== "hidden" && s.state !== "veryHidden");
  if (!sheet) throw new WorkbookError("The workbook has no sheets.");

  let headers: string[] = [];
  const rows: SheetRow[] = [];

  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    const texts: string[] = [];
    row.eachCell({ includeEmpty: true }, (cell: Cell, col) => (texts[col - 1] = cellText(cell.value)));

    if (headers.length === 0) {
      if (texts.some((t) => t)) headers = Array.from(texts, (t) => t ?? "");
      return;
    }

    const cells: Record<string, string> = {};
    headers.forEach((header, i) => {
      if (header) cells[headerKey(header)] = texts[i] ?? "";
    });
    if (Object.values(cells).some((v) => v !== "")) rows.push({ rowNumber, cells });
  });

  if (headers.length === 0) throw new WorkbookError("The first sheet is empty.");

  return { headers, rows };
}
