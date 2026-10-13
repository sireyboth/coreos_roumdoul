"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, FileDown, GripVertical } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { currentMonth, parseDate, shiftMonth } from "@/components/dashboard/calendar-shared";
import { api, ApiError, Employee } from "@/lib/api";
import { ATTENDANCE_REPORT_COLUMNS, attendanceReportToExcel } from "@/lib/excel-specs/time";
import { notifyError, notifySuccess } from "@/lib/notify";
import { cn } from "@/lib/utils";

const SELECT_CLASS = "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none";

// The columns picked last time, kept in this browser so the next export starts from them.
const LAYOUT_KEY = "attendance-export-layout";

type Layout = { order: string[]; hidden: string[]; charts: boolean; calendar: boolean };

function defaultLayout(): Layout {
  return { order: [...ATTENDANCE_REPORT_COLUMNS], hidden: [], charts: true, calendar: true };
}

function loadLayout(): Layout {
  try {
    const saved = JSON.parse(window.localStorage.getItem(LAYOUT_KEY) ?? "null") as Partial<Layout> | null;
    if (!saved || !Array.isArray(saved.order)) return defaultLayout();
    // Columns added to the report since the layout was saved go at the end, ticked.
    const known = saved.order.filter((c) => ATTENDANCE_REPORT_COLUMNS.includes(c));
    return {
      order: [...known, ...ATTENDANCE_REPORT_COLUMNS.filter((c) => !known.includes(c))],
      hidden: (saved.hidden ?? []).filter((c) => known.includes(c)),
      charts: saved.charts ?? true,
      calendar: saved.calendar ?? true,
    };
  } catch {
    return defaultLayout();
  }
}

function saveLayout(layout: Layout) {
  try {
    window.localStorage.setItem(LAYOUT_KEY, JSON.stringify(layout));
  } catch {
    // Private windows can refuse storage; the export still works, it just isn't remembered.
  }
}

function move<T>(list: T[], from: number, to: number): T[] {
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

// Matches the limit the server enforces, so the button explains itself instead of failing.
const MAX_DAYS = 366;

function monthRange(month: string): { from: string; to: string } {
  const first = parseDate(`${month}-01`);
  const lastDay = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  return { from: `${month}-01`, to: `${month}-${String(lastDay).padStart(2, "0")}` };
}

function daysBetween(from: string, to: string): number {
  return Math.round((parseDate(to).getTime() - parseDate(from).getTime()) / 86_400_000);
}

/**
 * Downloads the attendance report as an Excel workbook. Managers can pick one employee
 * or everyone; with `employee` set, the report is locked to that person; with
 * neither, it's the signed-in person's own records (the server enforces that).
 */
export function AttendanceExportDialog({
  open,
  onOpenChange,
  month = currentMonth(),
  employee,
  canPickEmployee = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The month the page is showing — the report starts on it. */
  month?: string;
  /** Lock the report to this one employee. */
  employee?: { id: number; name: string };
  /** Show the "who" picker (managers only). Ignored when `employee` is set. */
  canPickEmployee?: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl">
        {/* Mounted only while open, so every visit starts from fresh defaults. */}
        <ExportForm month={month} employee={employee} canPickEmployee={canPickEmployee} onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

function ExportForm({
  month,
  employee,
  canPickEmployee,
  onDone,
}: {
  month: string;
  employee?: { id: number; name: string };
  canPickEmployee: boolean;
  onDone: () => void;
}) {
  const initial = monthRange(month);
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [employeeId, setEmployeeId] = useState("");
  const [employees, setEmployees] = useState<Employee[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  // Only mounted while the dialog is open, so this always runs in the browser.
  const [layout, setLayout] = useState(loadLayout);

  const picked = layout.order.filter((c) => !layout.hidden.includes(c));
  const showPicker = canPickEmployee && !employee;

  useEffect(() => {
    if (!showPicker) return;
    let cancelled = false;

    api.employees
      .list()
      .then((res) => !cancelled && setEmployees([...res.data].sort((a, b) => a.name.localeCompare(b.name))))
      .catch(() => !cancelled && setEmployees([]));

    return () => {
      cancelled = true;
    };
  }, [showPicker]);

  const span = from && to ? daysBetween(from, to) : null;
  const rangeProblem =
    !from || !to
      ? "Choose both dates."
      : span! < 0
        ? "The end date comes before the start date."
        : span! > MAX_DAYS
          ? "Pick a range of one year or less."
          : null;

  function applyMonth(target: string) {
    const range = monthRange(target);
    setFrom(range.from);
    setTo(range.to);
  }

  async function handleDownload(e: React.FormEvent) {
    e.preventDefault();
    if (rangeProblem || picked.length === 0) return;

    setError(null);
    setDownloading(true);
    saveLayout(layout);

    try {
      const { blob, filename } = await api.attendance.export({
        from,
        to,
        employee_id: employee?.id ?? (employeeId ? Number(employeeId) : undefined),
      });
      const saved = await attendanceReportToExcel(blob, filename, {
        columns: picked,
        charts: layout.charts,
        calendar: layout.calendar,
        range: { from, to },
      });
      notifySuccess("Excel file downloaded", saved);
      onDone();
    } catch (err) {
      notifyError(err);
      setError(err instanceof ApiError ? (err.errors ? Object.values(err.errors)[0][0] : err.message) : "Something went wrong.");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{employee ? `Export attendance — ${employee.name}` : "Export attendance report"}</DialogTitle>
        <DialogDescription>Download an Excel workbook (.xlsx) — it also opens in Google Sheets and Numbers.</DialogDescription>
      </DialogHeader>

      <form onSubmit={handleDownload} className="flex flex-col gap-4">
        {/* Side by side on wide screens: what to export on the left, the columns on the right. */}
        <div className="grid gap-6 md:grid-cols-[18rem_1fr]">
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => applyMonth(currentMonth())}>
                This month
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => applyMonth(shiftMonth(currentMonth(), -1))}>
                Last month
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="export-from">From</Label>
                <Input id="export-from" type="date" required value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="export-to">To</Label>
                <Input id="export-to" type="date" required value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
              </div>
            </div>
            {rangeProblem && <p className="-mt-2 text-xs text-destructive">{rangeProblem}</p>}

            {showPicker && (
              <div className="flex flex-col gap-2">
                <Label htmlFor="export-employee">Employee</Label>
                <select id="export-employee" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} className={SELECT_CLASS}>
                  <option value="">All employees</option>
                  {employees?.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name}
                      {e.employee_code ? ` (${e.employee_code})` : ""}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                checked={layout.calendar}
                onChange={(e) => setLayout({ ...layout, calendar: e.target.checked })}
                className="mt-0.5 size-4 rounded border-input"
              />
              <span>
                Add a Calendar sheet
                <span className="block text-xs text-muted-foreground">Employees down the side, dates across the top, with status totals.</span>
              </span>
            </label>

            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                checked={layout.charts}
                onChange={(e) => setLayout({ ...layout, charts: e.target.checked })}
                className="mt-0.5 size-4 rounded border-input"
              />
              <span>
                Add a Charts sheet
                <span className="block text-xs text-muted-foreground">Days by status, worked hours and late minutes per employee.</span>
              </span>
            </label>
          </div>

          <ColumnPicker layout={layout} onChange={setLayout} />
        </div>

        {error && <Alert variant="destructive">{error}</Alert>}

        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
          <Button type="submit" disabled={downloading || rangeProblem !== null || picked.length === 0}>
            <FileDown className="size-4" />
            {downloading ? "Preparing…" : "Download Excel"}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}

/**
 * Which columns go in the export, and in what order. Drag a row by its handle
 * to move it, or use the arrows (keyboard and touch screens). Unticked
 * columns keep their place, so ticking one again puts it back where it was.
 */
function ColumnPicker({ layout, onChange }: { layout: Layout; onChange: (layout: Layout) => void }) {
  const [dragging, setDragging] = useState<number | null>(null);
  const hidden = new Set(layout.hidden);
  const pickedCount = layout.order.length - hidden.size;

  const reorder = (from: number, to: number) => {
    if (to < 0 || to >= layout.order.length || from === to) return;
    onChange({ ...layout, order: move(layout.order, from, to) });
  };

  const toggle = (column: string) =>
    onChange({
      ...layout,
      hidden: hidden.has(column) ? layout.hidden.filter((c) => c !== column) : [...layout.hidden, column],
    });

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <Label>
          Columns{" "}
          <span className="font-normal text-muted-foreground">
            ({pickedCount} of {layout.order.length})
          </span>
        </Label>
        <div className="flex gap-1">
          <Button type="button" variant="ghost" size="xs" onClick={() => onChange({ ...layout, hidden: [] })}>
            All
          </Button>
          <Button type="button" variant="ghost" size="xs" onClick={() => onChange({ ...layout, hidden: [...layout.order] })}>
            None
          </Button>
          <Button type="button" variant="ghost" size="xs" onClick={() => onChange({ ...defaultLayout(), charts: layout.charts, calendar: layout.calendar })}>
            Reset
          </Button>
        </div>
      </div>

      <ol className="max-h-[55vh] min-h-64 overflow-y-auto rounded-md border border-input">
        {layout.order.map((column, i) => (
          <li
            key={column}
            draggable
            onDragStart={(e) => {
              setDragging(i);
              e.dataTransfer.effectAllowed = "move";
            }}
            onDragOver={(e) => {
              e.preventDefault();
              // Moves as the pointer passes over each row, so the list shows where it will land.
              if (dragging === null || dragging === i) return;
              reorder(dragging, i);
              setDragging(i);
            }}
            onDragEnd={() => setDragging(null)}
            onDrop={(e) => e.preventDefault()}
            className={cn(
              "flex items-center gap-2 border-b border-input px-2 py-1.5 last:border-b-0 hover:bg-muted/50",
              dragging === i && "bg-muted",
              hidden.has(column) && "text-muted-foreground",
            )}
          >
            <GripVertical className="size-4 shrink-0 cursor-grab text-muted-foreground active:cursor-grabbing" aria-hidden />
            <label className="flex min-w-0 flex-1 items-center gap-2">
              <input
                type="checkbox"
                checked={!hidden.has(column)}
                onChange={() => toggle(column)}
                className="size-4 rounded border-input"
              />
              <span className="truncate">{column}</span>
            </label>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              disabled={i === 0}
              onClick={() => reorder(i, i - 1)}
              aria-label={`Move ${column} up`}
            >
              <ChevronUp className="size-3.5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              disabled={i === layout.order.length - 1}
              onClick={() => reorder(i, i + 1)}
              aria-label={`Move ${column} down`}
            >
              <ChevronDown className="size-3.5" />
            </Button>
          </li>
        ))}
      </ol>
      {pickedCount === 0 && <p className="text-xs text-destructive">Tick at least one column.</p>}
    </div>
  );
}
