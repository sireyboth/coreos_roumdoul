import { ACCOUNT_BLOCKED_CODES, ApiError } from "@/lib/api";
import { headerKey, type SheetRow, type TemplateColumn } from "@/lib/excel";

/**
 * The shared rules behind every "Import from Excel": what a column holds, how
 * a cell is read and checked, and how a module saves one row.
 *
 * Each row is saved through the module's normal API call — the same one the
 * page's own form uses — so plan limits, permissions, branch access and every
 * server-side check apply exactly as if the row had been typed in by hand.
 */

export type FieldType = "text" | "integer" | "number" | "date" | "time" | "boolean" | "email";

export type ImportField = {
  key: string;
  header: string;
  type?: FieldType;
  required?: boolean;
  /** Accepted values. Matched against the label, the value or an alias, ignoring case and punctuation. */
  options?: { value: string; label: string; aliases?: string[] }[];
  /** What to type — shown on the template's header and Instructions sheet. */
  hint: string;
  example?: string;
  /** Other headers that mean the same column (e.g. the export's wording). */
  aliases?: string[];
  /** An extra format check, run while reviewing: returns the problem, or null when fine. */
  validate?: (text: string) => string | null;
};

export type RowValue = string | number | boolean;

/** One parsed row. Blank cells are absent — "leave this as it is", never "clear it". */
export class Row {
  constructor(private readonly values: Record<string, RowValue>) {}

  has(key: string): boolean {
    return key in this.values;
  }

  text(key: string): string | undefined {
    const value = this.values[key];
    return value === undefined ? undefined : String(value);
  }

  number(key: string): number | undefined {
    const value = this.values[key];
    return typeof value === "number" ? value : undefined;
  }

  flag(key: string): boolean | undefined {
    const value = this.values[key];
    return typeof value === "boolean" ? value : undefined;
  }

  /** Only the keys that were filled in, for a "change just these" update. */
  pick<K extends string>(...keys: K[]): Partial<Record<K, RowValue>> {
    const out: Partial<Record<K, RowValue>> = {};
    for (const key of keys) if (key in this.values) out[key] = this.values[key];
    return out;
  }
}

export type SaveResult = "created" | "updated" | "skipped";

export type ImportSetting = { key: string; label: string; description?: string; default: boolean };

export type ImportSpec<Ctx> = {
  /** e.g. { one: "employee", many: "employees" } */
  noun: { one: string; many: string };
  templateFile: string;
  fields: ImportField[];
  /** How a row that already exists is recognised, in plain words. */
  matching: string;
  /** Extra lines for the template's Instructions sheet. */
  notes?: string[] | ((ctx: Ctx) => string[]);
  /** Tick boxes shown before importing, passed to save(). */
  settings?: ImportSetting[];
  /** Everything save() needs to look names up (branches, shifts…). Loaded fresh for each run. */
  load: () => Promise<Ctx>;
  /** Dropdown values for the template, from the company's own data. */
  choices?: (ctx: Ctx) => Partial<Record<string, string[]>>;
  save: (row: Row, ctx: Ctx, settings: Record<string, boolean>) => Promise<SaveResult>;
};

/** A row-level problem the spec found itself (e.g. an unknown branch name). */
export class RowError extends Error {}

// ───────────────────────────── Parsing ─────────────────────────────

const pad = (n: number) => String(n).padStart(2, "0");

function parseDate(text: string): string | null {
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T].*)?$/.exec(text);
  if (!m) m = /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/.exec(text);
  if (!m) return null;

  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  // Rejects 2026-02-31 and the like, which Date would quietly roll over.
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) return null;
  return `${y}-${pad(mo)}-${pad(d)}`;
}

function parseTime(text: string): string | null {
  // An Excel time that came through as a fraction of a day (0.5 = 12:00).
  if (/^0?\.\d+$/.test(text)) {
    const minutes = Math.round(Number(text) * 24 * 60);
    return `${pad(Math.floor(minutes / 60) % 24)}:${pad(minutes % 60)}`;
  }

  const m = /^(\d{1,2})[:.](\d{2})(?::\d{2})?\s*(am|pm)?$/i.exec(text);
  if (!m) return null;

  let hours = Number(m[1]);
  const minutes = Number(m[2]);
  const meridiem = m[3]?.toLowerCase();
  if (meridiem) {
    if (hours < 1 || hours > 12) return null;
    hours = (hours % 12) + (meridiem === "pm" ? 12 : 0);
  }
  if (hours > 23 || minutes > 59) return null;
  return `${pad(hours)}:${pad(minutes)}`;
}

const YES = ["yes", "y", "true", "1", "on", "active"];
const NO = ["no", "n", "false", "0", "off", "inactive"];

// "On-leave", "on_leave" and "ON LEAVE" all mean On leave.
const squash = (value: string) => value.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");

/**
 * The option a cell means: its label, value or one of its aliases, ignoring
 * case, spaces and punctuation. Failing that, a clear start of one
 * ("Terminate", "Susp") — but only when it fits a single option, so nothing
 * is guessed.
 */
function matchOption<O extends { value: string; label: string; aliases?: string[] }>(options: O[], text: string): O | undefined {
  const wanted = squash(text);
  if (!wanted) return undefined;

  const names = (o: O) => [o.label, o.value, ...(o.aliases ?? [])].map(squash);
  const exact = options.find((o) => names(o).includes(wanted));
  if (exact || wanted.length < 4) return exact;

  const started = options.filter((o) => names(o).some((name) => name.startsWith(wanted)));
  return started.length === 1 ? started[0] : undefined;
}

function parseValue(field: ImportField, text: string): { value?: RowValue; problem?: string } {
  if (field.options) {
    const option = matchOption(field.options, text);
    return option
      ? { value: option.value }
      : { problem: `${field.header} "${text}" isn't valid. Use one of: ${field.options.map((o) => o.label).join(", ")}.` };
  }

  switch (field.type) {
    case "integer": {
      const n = Number(text);
      return Number.isInteger(n) ? { value: n } : { problem: `${field.header} must be a whole number.` };
    }
    case "number": {
      const n = Number(text.replace(/,/g, ""));
      return Number.isFinite(n) ? { value: n } : { problem: `${field.header} must be a number.` };
    }
    case "date": {
      const date = parseDate(text);
      return date ? { value: date } : { problem: `${field.header} must be a date like 2026-09-01.` };
    }
    case "time": {
      const time = parseTime(text);
      return time ? { value: time } : { problem: `${field.header} must be a time like 08:30.` };
    }
    case "boolean": {
      const word = text.toLowerCase();
      if (YES.includes(word)) return { value: true };
      if (NO.includes(word)) return { value: false };
      return { problem: `${field.header} must be Yes or No.` };
    }
    case "email":
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text) ? { value: text.toLowerCase() } : { problem: `${field.header} isn't a valid email address.` };
    default:
      return { value: text };
  }
}

export type ParsedRow = {
  rowNumber: number;
  cells: Record<string, string>;
  row: Row;
  problems: string[];
};

/** Which header in the file feeds each field (by headerKey), or undefined if the file has none. */
export function mapColumns(fields: ImportField[], headers: string[]): Record<string, string | undefined> {
  const present = new Set(headers.map(headerKey));
  const map: Record<string, string | undefined> = {};
  for (const field of fields) {
    map[field.key] = [field.header, ...(field.aliases ?? [])].map(headerKey).find((h) => present.has(h));
  }
  return map;
}

export function parseRows(fields: ImportField[], columns: Record<string, string | undefined>, rows: SheetRow[]): ParsedRow[] {
  return rows.map(({ rowNumber, cells }) => {
    const values: Record<string, RowValue> = {};
    const problems: string[] = [];

    for (const field of fields) {
      const column = columns[field.key];
      const text = column ? (cells[column] ?? "").trim() : "";

      if (text === "") {
        if (field.required) problems.push(`${field.header} is required.`);
        continue;
      }

      const { value, problem } = parseValue(field, text);
      const invalid = problem ?? field.validate?.(text) ?? null;
      if (invalid) problems.push(invalid);
      if (!invalid && value !== undefined) values[field.key] = value;
    }

    return { rowNumber, cells, row: new Row(values), problems };
  });
}

export function templateColumns(fields: ImportField[], choices: Partial<Record<string, string[]>> = {}): TemplateColumn[] {
  return fields.map((field) => ({
    header: field.header,
    required: field.required,
    hint: field.hint,
    example: field.example,
    choices: field.options?.map((o) => o.label) ?? choices[field.key],
  }));
}

// ───────────────────────────── Helpers ─────────────────────────────

/** The clearest single message for why a row failed. */
export function errorText(err: unknown): string {
  if (err instanceof ApiError) {
    const details = err.errors ? Object.values(err.errors).flat() : [];
    return details.length > 0 ? details.join(" ") : err.message;
  }
  if (err instanceof Error) return err.message;
  return "Something went wrong.";
}

/**
 * Failures that will hit every remaining row the same way — no point trying
 * them all. The run stops and says why.
 */
export function isFatal(err: unknown): boolean {
  return (
    err instanceof ApiError &&
    (err.status === 401 ||
      err.status === 403 ||
      ["plan_limit_reached", "network_error", ...ACCOUNT_BLOCKED_CODES].includes(err.code ?? ""))
  );
}

const norm = (value: string) => value.trim().replace(/\s+/g, " ").toLowerCase();

/**
 * Finds records by any of their names (e.g. a branch by name or code),
 * ignoring case and extra spaces. New records can be added mid-import, so a
 * later row can refer to something an earlier row just created.
 */
export class Lookup<T> {
  private readonly map = new Map<string, T>();
  // Names shared by two different records (e.g. two employees called "Sok Dara").
  private readonly ambiguous = new Set<string>();

  constructor(
    items: T[],
    private readonly keys: ((item: T) => string | null | undefined)[],
    private readonly what: string,
  ) {
    items.forEach((item) => this.add(item));
  }

  add(item: T) {
    for (const key of this.keys) {
      const value = key(item);
      if (!value) continue;
      const existing = this.map.get(norm(value));
      if (existing === undefined) this.map.set(norm(value), item);
      else if (existing !== item) this.ambiguous.add(norm(value));
    }
  }

  /** Replaces whatever was stored under this record's names (after an update). */
  put(item: T) {
    for (const key of this.keys) {
      const value = key(item);
      if (value) this.map.set(norm(value), item);
    }
  }

  find(value: string | undefined): T | undefined {
    return value ? this.map.get(norm(value)) : undefined;
  }

  /** Like find(), but a name that matches nothing is the row's error. */
  require(value: string): T {
    if (this.ambiguous.has(norm(value))) {
      throw new RowError(`More than one ${this.what} is called "${value}". Use a code or ID instead of the name.`);
    }
    const item = this.find(value);
    if (!item) throw new RowError(`No ${this.what} called "${value}" was found.`);
    return item;
  }

  names(): string[] {
    return [...new Set([...this.map.values()].map((item) => this.keys[0](item)).filter((v): v is string => Boolean(v)))].sort(
      (a, b) => a.localeCompare(b),
    );
  }
}

/** Shared option lists, so exports write exactly what imports accept. */
export const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
];

export function optionLabel(options: { value: string; label: string }[], value: string | null | undefined): string {
  if (!value) return "";
  return options.find((o) => o.value === value)?.label ?? value;
}

export const yesNo = (value: boolean | null | undefined) => (value == null ? "" : value ? "Yes" : "No");
