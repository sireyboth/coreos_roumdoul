// How attendance statuses look, for every screen and file: one place to read
// codes, colours, text colour and bold from. Companies change them in
// Attendance → Status codes; screens draw them with <StatusChip>
// (components/dashboard/shared/status-chip.tsx), Excel and PDF with the fills
// and inks below. Nothing else should hold a status colour of its own.

import type { CalendarAttendance, DayColor, DayStatus, LeaveColor, ReportCodes, StatusLook, TextColor } from "@/lib/api";

/** The defaults, the same as the server's (App\Support\ReportCodes); shown until the company's own arrive. */
export const DEFAULT_REPORT_CODES: ReportCodes = {
  statuses: {
    P: { code: "P", color: "green", text: "auto", bold: true },
    L: { code: "L", color: "amber", text: "auto", bold: true },
    E: { code: "E", color: "yellow", text: "auto", bold: true },
    LE: { code: "LE", color: "gold", text: "auto", bold: true },
    M: { code: "M", color: "orange", text: "auto", bold: true },
    A: { code: "A", color: "red", text: "auto", bold: true },
    W: { code: "W", color: "blue", text: "auto", bold: true },
    H: { code: "H", color: "gray", text: "auto", bold: true },
    OFF: { code: "OFF", color: "light", text: "auto", bold: true },
  },
  leave: [],
};

/** Leave with no type of its own look (or no code): "LV" in violet. */
export const FALLBACK_LEAVE_LOOK: StatusLook<LeaveColor> = { code: "LV", color: "violet", text: "auto", bold: true };

/** A leave day's look, found by the code the report shows for its type. */
export function leaveLook(codes: ReportCodes, reportCode: string | null | undefined): StatusLook<LeaveColor> {
  const type = reportCode ? codes.leave.find((l) => l.report_code === reportCode) : undefined;
  return type ? { code: type.report_code!, color: type.color, text: type.text, bold: type.bold } : FALLBACK_LEAVE_LOOK;
}

/**
 * The attendance list's statuses as report statuses, so a badge there wears
 * the same colours: absent there = "A" here. The rest have no report status.
 */
export const DAY_STATUS_LOOK: Partial<Record<string, DayStatus>> = {
  complete: "P",
  incomplete: "M",
  absent: "A",
  worked_off: "W",
  off: "OFF",
};

/** The team calendar's attendance marks as report statuses. */
export const CALENDAR_ATTENDANCE_LOOK: Record<CalendarAttendance, DayStatus> = {
  present: "P",
  late: "L",
  incomplete: "M",
  absent: "A",
  worked: "W",
};

// ── Files (Excel, PDF) ─────────────────────────────────────────────────

/** Every background colour as an Excel fill (ARGB) and its own dark text colour. */
export const COLOR_FILLS: Record<DayColor | LeaveColor, { fill: string; ink: string }> = {
  green: { fill: "FFDCFCE7", ink: "#166534" },
  amber: { fill: "FFFEF3C7", ink: "#92400e" },
  yellow: { fill: "FFFEF9C3", ink: "#854d0e" },
  gold: { fill: "FFFDE68A", ink: "#78350f" },
  orange: { fill: "FFFFEDD5", ink: "#9a3412" },
  red: { fill: "FFFEE2E2", ink: "#991b1b" },
  blue: { fill: "FFDBEAFE", ink: "#1e40af" },
  gray: { fill: "FFE5E7EB", ink: "#374151" },
  light: { fill: "FFF3F4F6", ink: "#6b7280" },
  violet: { fill: "FFEDE9FE", ink: "#5b21b6" },
  fuchsia: { fill: "FFFAE8FF", ink: "#86198f" },
  pink: { fill: "FFFCE7F3", ink: "#9d174d" },
  indigo: { fill: "FFE0E7FF", ink: "#3730a3" },
  cyan: { fill: "FFCFFAFE", ink: "#155e75" },
  teal: { fill: "FFCCFBF1", ink: "#115e59" },
  lime: { fill: "FFECFCCB", ink: "#3f6212" },
  slate: { fill: "FFE2E8F0", ink: "#334155" },
};

/** A chosen text colour in files; "auto" takes the background's own. */
const TEXT_INK: Record<Exclude<TextColor, "auto">, string> = {
  dark: "#111827",
  white: "#ffffff",
  red: "#b91c1c",
  green: "#15803d",
  blue: "#1d4ed8",
  orange: "#c2410c",
  violet: "#6d28d9",
  gray: "#6b7280",
};

/** Unpaid leave reads red unless the company picked a text colour for it. */
export const UNPAID_INK = "#b91c1c";

/** A look's text colour in files (hex). */
export function lookInk(look: Pick<StatusLook, "color" | "text">, unpaid = false): string {
  if (look.text !== "auto") return TEXT_INK[look.text];
  return unpaid ? UNPAID_INK : COLOR_FILLS[look.color].ink;
}
