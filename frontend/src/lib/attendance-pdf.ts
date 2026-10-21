import { daysWith, duration, ISSUES, totalsOf, type IssueKind, type PersonInsight, type ReportDay } from "@/lib/attendance-insights";
import { CALENDAR_CODES, type AttendanceCalendar } from "@/lib/excel-specs/time";
import { escapeHtml, printHtmlDocument, REPORT_FONTS } from "@/lib/print-pdf";

/**
 * The attendance report as a printed document, saved as PDF by the browser.
 *
 * A PDF library can't shape Khmer (names and notes are often Khmer), so the
 * report is laid out as a print-ready page and handed to the browser's own
 * print engine — "Save as PDF" gives selectable text with correct Khmer.
 */

export type AttendancePdfOptions = {
  company: string;
  generatedBy?: string | null;
  /** e.g. "October 2026" or "1 Jun 2025 – 30 Nov 2025". */
  periodLabel: string;
  range: { from: string; to: string };
  /** What the report covers, e.g. "All employees" or "Branch: HQ". */
  scope: string;
  people: PersonInsight[];
  /** The month grid; left out when not asked for or too long to fit a page. */
  calendar?: AttendanceCalendar | null;
  /** Per-person day lists; left out when not asked for. */
  detail?: { kinds: IssueKind[]; minLate: number } | null;
  /** Lateness under this many minutes isn't counted (matches the detail's setting). */
  minLate: number;
};

// The calendar grid fits one landscape page up to a month and a bit.
export const PDF_CALENDAR_MAX_DAYS = 31;

const esc = escapeHtml;

const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const utc = (date: string) => new Date(`${date}T00:00:00Z`);
const shortDate = (date: string) => utc(date).toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short", timeZone: "UTC" });
const monthName = (month: string) => utc(`${month}-01`).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });

// Calendar codes: a light fill with dark ink of the same hue, readable in colour and in greyscale.
const CODE_INK: Record<string, string> = {
  P: "#166534", L: "#92400e", E: "#854d0e", LE: "#78350f", M: "#9a3412", A: "#991b1b", "½": "#6d28d9", W: "#1e40af", LV: "#5b21b6", H: "#374151", OFF: "#6b7280",
};
const fill = (argb: string) => `#${argb.slice(2)}`;

function lateChip(minutes: number): string {
  const cls = minutes > 60 ? "sev3" : minutes >= 15 ? "sev2" : "sev1";
  return `<span class="chip ${cls}">${esc(duration(minutes))}</span>`;
}

const ISSUE_CLASS: Record<IssueKind, string> = { late: "", early: "tag-early", missed: "tag-missed", absent: "tag-absent" };

function header(o: AttendancePdfOptions): string {
  const generated = new Date().toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  return `
  <header class="masthead">
    <div>
      <p class="eyebrow">${esc(o.company)}</p>
      <h1>Attendance Report</h1>
      <p class="period">${esc(o.periodLabel)}</p>
    </div>
    <dl class="meta">
      <div><dt>Covers</dt><dd>${esc(o.scope)}</dd></div>
      <div><dt>Dates</dt><dd>${esc(o.range.from)} → ${esc(o.range.to)}</dd></div>
      <div><dt>Generated</dt><dd>${esc(generated)}${o.generatedBy ? ` · ${esc(o.generatedBy)}` : ""}</dd></div>
    </dl>
  </header>`;
}

function kpis(people: PersonInsight[]): string {
  const t = totalsOf(people);
  const cards: [string, string, string][] = [
    ["Employees", String(t.people), `${t.workDays} work days`],
    ["Late rate", `${t.latePct}%`, `${t.lateDays} late days`],
    ["Time lost to lateness", duration(t.lateMinutes), t.lateDays ? `avg ${duration(Math.round(t.lateMinutes / t.lateDays))}` : "—"],
    ["Absence rate", `${t.absencePct}%`, `${t.absentDays} absent days`],
    ["Missed scans", String(t.missedDays), "days with a scan missing"],
    ["Leave", String(t.leaveDays), "days on leave"],
  ];
  return `<section class="kpis">${cards
    .map(([label, value, sub]) => `<div class="kpi"><p class="kpi-label">${esc(label)}</p><p class="kpi-value">${esc(value)}</p><p class="kpi-sub">${esc(sub)}</p></div>`)
    .join("")}</section>`;
}

function ranking(people: PersonInsight[], minLate: number): string {
  const ranked = [...people].sort((a, b) => b.lateDays - a.lateDays || b.absentDays - a.absentDays || a.name.localeCompare(b.name));
  const n = (v: number) => (v ? String(v) : `<span class="muted">·</span>`);
  const rows = ranked
    .map(
      (p, i) => `<tr>
        <td class="rank">${i + 1}</td>
        <td class="nowrap"><strong>${esc(p.name)}</strong><br><span class="muted small">${esc([p.code, p.branch].filter(Boolean).join(" · "))}</span></td>
        <td class="num">${p.workDays}</td>
        <td class="num"><strong>${n(p.lateDays)}</strong></td>
        <td class="num">${p.lateDays ? `${p.latePct}%` : n(0)}</td>
        <td class="num">${p.lateMinutes ? esc(duration(p.lateMinutes)) : n(0)}</td>
        <td class="num">${p.longestLate ? esc(duration(p.longestLate)) : n(0)}</td>
        <td class="num">${n(p.missedDays)}</td>
        <td class="num">${n(p.absentDays)}</td>
        <td class="num">${p.absentDays ? `${p.absencePct}%` : n(0)}</td>
        <td class="num">${n(p.leaveDays)}</td>
        <td class="small nowrap">${p.lateWeekday ? `${WEEKDAY[p.lateWeekday.weekday]} ×${p.lateWeekday.count}` : ""}</td>
      </tr>`,
    )
    .join("");
  return `<section>
    <h2>Ranking <span class="h2-note">most late days first${minLate > 1 ? ` · lateness from ${minLate} min` : ""}</span></h2>
    <table class="data">
      <thead><tr>
        <th class="rank">#</th><th>Employee</th><th class="num">Days</th><th class="num">Late days</th><th class="num">Late %</th>
        <th class="num">Total late</th><th class="num">Longest</th><th class="num">Missed</th><th class="num">Absent</th>
        <th class="num">Abs. %</th><th class="num">Leave</th><th>Pattern</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </section>`;
}

function calendarPage(calendar: AttendanceCalendar, people: PersonInsight[]): string {
  const keys = new Set(people.map((p) => p.key));
  const rows = calendar.people.filter((p) => keys.has(p.key));
  const head = calendar.dates
    .map((date) => {
      const d = utc(date);
      const weekend = d.getUTCDay() === 0 || d.getUTCDay() === 6;
      return `<th class="day${weekend ? " weekend" : ""}"><span>${WEEKDAY[d.getUTCDay()].slice(0, 2)}</span>${d.getUTCDate()}</th>`;
    })
    .join("");
  const totals = ["P", "L", "E", "M", "A", "½", "LV"];
  const body = rows
    .map(
      (p) => `<tr>
        <td class="who"><strong>${esc(p.name)}</strong>${p.code ? ` <span class="muted">${esc(p.code)}</span>` : ""}</td>
        ${p.cells
          .map((cell) => {
            if (!cell) return `<td class="cell"></td>`;
            const c = CALENDAR_CODES.find((x) => x.code === cell.code)!;
            return `<td class="cell"><span style="background:${fill(c.fill)};color:${CODE_INK[cell.code]}">${esc(cell.code)}</span></td>`;
          })
          .join("")}
        ${totals.map((code, i) => `<td class="tot${i === 0 ? " first" : ""}">${p.totals[code] || `<span class="muted">·</span>`}</td>`).join("")}
      </tr>`,
    )
    .join("");
  const legend = CALENDAR_CODES.map(
    (c) => `<span class="legend-item"><span class="code" style="background:${fill(c.fill)};color:${CODE_INK[c.code]}">${esc(c.code)}</span>${esc(c.legend)}</span>`,
  ).join("");

  return `<section class="landscape">
    <h2>Month at a glance</h2>
    <table class="grid">
      <thead><tr><th class="who">Employee</th>${head}${totals.map((code, i) => `<th class="tot${i === 0 ? " first" : ""}">${esc(CALENDAR_CODES.find((c) => c.code === code)!.total)}</th>`).join("")}</tr></thead>
      <tbody>${body}</tbody>
    </table>
    <p class="legend">${legend}</p>
  </section>`;
}

function detailSection(person: PersonInsight, days: ReportDay[], kinds: IssueKind[], minLate: number): string {
  const months = new Map<string, ReportDay[]>();
  for (const day of days) months.set(day.date.slice(0, 7), [...(months.get(day.date.slice(0, 7)) ?? []), day]);

  const stats = [
    `${person.workDays} work days`,
    person.lateDays ? `late ${person.lateDays}× (${person.latePct}%) · ${duration(person.lateMinutes)}` : "never late",
    person.missedDays ? `${person.missedDays} missed ${person.missedDays === 1 ? "scan" : "scans"}` : "",
    person.absentDays ? `${person.absentDays} absent` : "",
    person.leaveDays ? `${person.leaveDays} leave` : "",
  ].filter(Boolean);

  const body = [...months]
    .map(([month, list]) => {
      const late = list.filter((d) => d.late >= minLate);
      const subtotal = late.length ? `${late.length} late · ${duration(late.reduce((n, d) => n + d.late, 0))}` : "";
      const rows = list
        .map((d) => {
          const tags = d.issues
            .filter((k) => k !== "late" && kinds.includes(k))
            .map((k) => `<span class="tag ${ISSUE_CLASS[k]}">${k === "early" ? `Early ${esc(duration(d.early))}` : esc(ISSUES.find((i) => i.kind === k)!.label)}</span>`)
            .join(" ");
          return `<tr>
            <td class="nowrap"><strong>${esc(shortDate(d.date))}</strong></td>
            <td class="nowrap muted">${d.expectedIn ? `${esc(d.expectedIn)}–${esc(d.expectedOut ?? "")}` : "—"}</td>
            <td class="nowrap mono">${esc(d.in ?? "—")}</td>
            <td class="nowrap mono">${esc(d.out ?? "—")}${d.edited ? ` <span class="edited" title="Edited">✎</span>` : ""}</td>
            <td class="nowrap">${d.late > 0 ? lateChip(d.late) : `<span class="muted">—</span>`}</td>
            <td class="nowrap">${tags}</td>
            <td class="note">${esc(d.note || d.leave)}</td>
          </tr>`;
        })
        .join("");
      return `<tbody>
        <tr class="month"><td colspan="7">${esc(monthName(month))}${subtotal ? `<span>${esc(subtotal)}</span>` : ""}</td></tr>
        ${rows}
      </tbody>`;
    })
    .join("");

  return `<article class="person">
    <div class="person-head">
      <h3>${esc(person.name)}${person.code ? ` <span>${esc(person.code)}</span>` : ""}</h3>
      <p>${esc([person.branch, person.department].filter(Boolean).join(" · "))}</p>
      <p class="person-stats">${stats.map(esc).join(" &nbsp;·&nbsp; ")}</p>
    </div>
    <table class="data detail">
      <thead><tr><th>Date</th><th>Schedule</th><th>In</th><th>Out</th><th>Late</th><th>Issue</th><th>Note</th></tr></thead>
      ${body}
    </table>
  </article>`;
}

function detail(o: AttendancePdfOptions): string {
  if (!o.detail || o.detail.kinds.length === 0) return "";
  const { kinds, minLate } = o.detail;
  const entries = o.people
    .map((p) => ({ p, days: daysWith(p, kinds, minLate) }))
    .filter((e) => e.days.length > 0)
    .sort((a, b) => b.p.lateDays - a.p.lateDays || a.p.name.localeCompare(b.p.name));
  const what = kinds.map((k) => ISSUES.find((i) => i.kind === k)!.label.toLowerCase()).join(", ");

  return `<section class="detail-start">
    <h2>Daily detail <span class="h2-note">${esc(what)}${kinds.includes("late") ? ` · late ≥ ${minLate} min` : ""}</span></h2>
    ${entries.length ? entries.map((e) => detailSection(e.p, e.days, kinds, minLate)).join("") : `<p class="muted">Nothing to list — a clean record for this period.</p>`}
  </section>`;
}

const DEFINITIONS = `<section class="definitions">
  <h2>How to read this report</h2>
  <dl>
    <div><dt>Work day</dt><dd>A scheduled day that has happened: present, late, missing a scan, or absent. Days off, holidays and leave are not work days.</dd></div>
    <div><dt>Late rate</dt><dd>Late days ÷ days the person came in. Approved late-arrival permission is not counted as late.</dd></div>
    <div><dt>Absence rate</dt><dd>Absent days ÷ work days. Approved leave is never an absence.</dd></div>
    <div><dt>Missed scan</dt><dd>The person came in but an expected check-in or check-out is missing. Shown separately — it is not lateness.</dd></div>
    <div><dt>Pattern</dt><dd>Shown when at least three late days, and 40% or more of them, fall on the same weekday.</dd></div>
    <div><dt>✎</dt><dd>A scan on that day was added or changed by an administrator or an approved correction.</dd></div>
  </dl>
</section>`;

const styles = (footer: string) => `
  @page { size: A4; margin: 14mm 12mm 16mm;
    @bottom-left { content: ${footer}; font: 8pt "Inter", sans-serif; color: #64748b; }
    @bottom-right { content: "Page " counter(page) " of " counter(pages); font: 8pt "Inter", sans-serif; color: #64748b; } }
  @page wide { size: A4 landscape; margin: 12mm; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  html { font-family: "Inter", "Segoe UI", "Noto Sans Khmer", "Khmer UI", "Leelawadee UI", system-ui, sans-serif; color: #0f172a; font-size: 9pt; line-height: 1.45; }
  body { margin: 0; }
  .muted { color: #64748b; } .small { font-size: 7.5pt; } .nowrap { white-space: nowrap; } .mono { font-variant-numeric: tabular-nums; }
  .masthead { display: flex; justify-content: space-between; gap: 24px; padding-top: 14px; border-top: 4px solid #4f46e5; margin-bottom: 18px; }
  .eyebrow { margin: 0; font-size: 8pt; font-weight: 600; letter-spacing: .08em; text-transform: uppercase; color: #4f46e5; }
  h1 { margin: 4px 0 2px; font-size: 22pt; font-weight: 700; letter-spacing: -.02em; }
  .period { margin: 0; font-size: 11pt; color: #334155; }
  .meta { margin: 0; display: grid; gap: 4px; font-size: 8pt; min-width: 210px; }
  .meta div { display: grid; grid-template-columns: 62px 1fr; gap: 8px; }
  .meta dt { color: #64748b; } .meta dd { margin: 0; font-weight: 500; }
  .kpis { display: grid; grid-template-columns: repeat(6, 1fr); gap: 8px; margin-bottom: 20px; }
  .kpi { border: 1px solid #e2e8f0; border-radius: 8px; padding: 9px 10px; background: #f8fafc; }
  .kpi-label { margin: 0; font-size: 7pt; text-transform: uppercase; letter-spacing: .05em; color: #64748b; }
  .kpi-value { margin: 3px 0 1px; font-size: 15pt; font-weight: 700; font-variant-numeric: tabular-nums; }
  .kpi-sub { margin: 0; font-size: 7pt; color: #64748b; }
  h2 { font-size: 12pt; margin: 18px 0 8px; break-after: avoid; }
  .h2-note { font-size: 8pt; font-weight: 400; color: #64748b; margin-left: 6px; }
  table { border-collapse: collapse; width: 100%; }
  thead { display: table-header-group; }
  tr { break-inside: avoid; }
  .data th { white-space: nowrap; text-align: left; font-size: 7pt; font-weight: 600; text-transform: uppercase; letter-spacing: .04em; color: #64748b; padding: 6px 6px; border-bottom: 1.5px solid #cbd5e1; }
  .data td { padding: 5px 5px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
  .num { text-align: right; font-variant-numeric: tabular-nums; }
  .rank { width: 18px; color: #94a3b8; }
  .landscape { page: wide; break-before: page; }
  .grid { font-size: 7pt; }
  .grid th { font-weight: 600; color: #64748b; padding: 3px 1px; border-bottom: 1.5px solid #cbd5e1; }
  .grid th.day span { display: block; font-size: 5.5pt; font-weight: 500; text-transform: uppercase; }
  .grid th.weekend { color: #0f172a; }
  .grid td { border-bottom: 1px solid #eef2f6; padding: 1.5px 1px; text-align: center; }
  .grid .who { text-align: left; white-space: nowrap; padding-right: 6px; max-width: 130px; overflow: hidden; text-overflow: ellipsis; }
  .grid .cell span { display: inline-block; min-width: 16px; padding: 1.5px 1px; border-radius: 3px; font-weight: 700; font-size: 6.5pt; }
  .grid .tot { font-variant-numeric: tabular-nums; padding: 1.5px 4px; } .grid .first { border-left: 1.5px solid #cbd5e1; }
  .legend { margin-top: 8px; font-size: 7pt; color: #475569; }
  .legend-item { display: inline-flex; align-items: center; gap: 4px; margin-right: 12px; }
  .legend .code { display: inline-block; min-width: 18px; text-align: center; border-radius: 3px; font-weight: 700; padding: 1px 3px; }
  .detail-start { break-before: page; }
  .person { margin-bottom: 16px; }
  .person-head { break-after: avoid; border-left: 3px solid #4f46e5; padding: 2px 0 2px 10px; margin-bottom: 6px; }
  .person-head h3 { margin: 0; font-size: 11pt; } .person-head h3 span { font-weight: 400; color: #64748b; }
  .person-head p { margin: 1px 0 0; font-size: 7.5pt; color: #64748b; }
  .person-head .person-stats { color: #334155; font-weight: 500; }
  .detail .month td { background: #f1f5f9; font-weight: 600; font-size: 7.5pt; padding: 4px 6px; border-bottom: none; }
  .detail .month span { float: right; font-weight: 400; color: #475569; }
  .detail .note { color: #475569; font-size: 8pt; width: 100%; }
  .chip { display: inline-block; padding: 1px 6px; border-radius: 4px; font-size: 7.5pt; font-variant-numeric: tabular-nums; }
  .sev1 { background: #fef3c7; color: #92400e; } .sev2 { background: #fde68a; color: #78350f; font-weight: 700; } .sev3 { background: #fee2e2; color: #991b1b; font-weight: 700; }
  .tag { display: inline-block; padding: 1px 5px; border-radius: 4px; font-size: 7pt; font-weight: 600; }
  .tag-early { background: #dbeafe; color: #1e40af; } .tag-missed { background: #ffedd5; color: #9a3412; } .tag-absent { background: #fee2e2; color: #991b1b; }
  .edited { color: #64748b; }
  .definitions { break-inside: avoid; margin-top: 22px; padding-top: 10px; border-top: 1px solid #e2e8f0; }
  .definitions h2 { font-size: 9pt; margin-top: 0; }
  .definitions dl { margin: 0; display: grid; grid-template-columns: 1fr 1fr; gap: 6px 18px; font-size: 7.5pt; }
  .definitions dt { font-weight: 600; } .definitions dd { margin: 0; color: #475569; }
`;

/** The whole report as an HTML document. */
export function attendancePdfHtml(o: AttendancePdfOptions): string {
  const footer = `"${o.company.replace(/"/g, "'")} · Attendance report · ${o.periodLabel.replace(/"/g, "'")}"`;
  const title = `Attendance report ${o.range.from} to ${o.range.to}`;
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>${esc(title)}</title>
${REPORT_FONTS}
<style>${styles(footer)}</style></head>
<body>
  ${header(o)}
  ${kpis(o.people)}
  ${ranking(o.people, o.minLate)}
  ${o.calendar ? calendarPage(o.calendar, o.people) : ""}
  ${detail(o)}
  ${DEFINITIONS}
</body></html>`;
}

/** Lays the report out and opens the print dialog, where "Save as PDF" makes the file. */
export function printAttendancePdf(o: AttendancePdfOptions): Promise<void> {
  return printHtmlDocument(attendancePdfHtml(o));
}
