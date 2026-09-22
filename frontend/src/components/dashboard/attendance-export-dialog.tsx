"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";
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
import { saveBlob } from "@/lib/download";
import { notifyError, notifySuccess } from "@/lib/notify";

const SELECT_CLASS = "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none";

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
 * Downloads the attendance report as a CSV file. Managers can pick one employee
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
      <DialogContent>
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
    if (rangeProblem) return;

    setError(null);
    setDownloading(true);

    try {
      const { blob, filename } = await api.attendance.export({
        from,
        to,
        employee_id: employee?.id ?? (employeeId ? Number(employeeId) : undefined),
      });
      saveBlob(blob, filename);
      notifySuccess("Report downloaded", filename);
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
        <DialogDescription>Download a CSV file you can open in Excel or Google Sheets.</DialogDescription>
      </DialogHeader>

      <form onSubmit={handleDownload} className="flex flex-col gap-4">
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

        {error && <Alert variant="destructive">{error}</Alert>}

        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
          <Button type="submit" disabled={downloading || rangeProblem !== null}>
            <Download className="size-4" />
            {downloading ? "Preparing…" : "Download CSV"}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}
