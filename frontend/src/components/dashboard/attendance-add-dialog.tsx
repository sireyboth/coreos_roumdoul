"use client";

import { useState } from "react";
import { CalendarPlus, Plus, Trash2 } from "lucide-react";
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
import { useApi } from "@/hooks/use-api";
import { api, ApiError, type AttendanceDay, type Employee } from "@/lib/api";
import { scansOn } from "@/lib/excel-specs/time";
import { notifyError, notifySuccess } from "@/lib/notify";

const SELECT_CLASS = "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none";

/** Today on this device's clock, as YYYY-MM-DD. */
function todayLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * A manager entering a whole day that has no record yet — someone worked a
 * day off without scanning, or the scanner was down all day. Saved at once
 * as an admin adjustment (with the reason), no request or approval needed.
 * A day that already has scans is opened instead, to be fixed with Adjust scans.
 */
export function AttendanceAddDialog({
  open,
  onOpenChange,
  onSaved,
  onOpenDay,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The day as recalculated after saving. */
  onSaved: (day: AttendanceDay | null) => void;
  /** The chosen date already has a record: show it rather than add to it blind. */
  onOpenDay: (day: AttendanceDay) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {/* Mounted only while open, so every visit starts from a clean form. */}
        {open && <AddForm onSaved={onSaved} onOpenDay={onOpenDay} />}
      </DialogContent>
    </Dialog>
  );
}

function AddForm({ onSaved, onOpenDay }: { onSaved: (day: AttendanceDay | null) => void; onOpenDay: (day: AttendanceDay) => void }) {
  const [employeeId, setEmployeeId] = useState("");
  const [date, setDate] = useState(todayLocal);
  const [times, setTimes] = useState<string[]>(["08:00", "17:00"]);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const { data: sorted, error: employeesError } = useApi(
    () => api.employees.all().then((list) => [...list].sort((a, b) => a.name.localeCompare(b.name))),
    [],
  );
  const employees: Employee[] | null = sorted ?? (employeesError ? [] : null);

  // The record found for an employee + date. A failed lookup is only a hint;
  // saving still works and the server has the final say.
  const { data: found } = useApi(
    employeeId && date
      ? () =>
          api.attendance
            .list({ employee_id: Number(employeeId), from: date, to: date, per_page: 1 })
            .then((res) => res.data.find((d) => d.date.slice(0, 10) === date && d.scans.length > 0) ?? null)
      : null,
    [employeeId, date],
  );
  const existing = found ?? null;

  const filled = times.filter(Boolean);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!employeeId || existing) return;
    setError(null);
    setSaving(true);

    try {
      const res = await api.attendance.adjust({ employee_id: Number(employeeId), date, reason, add: scansOn(date, filled), void: [] });
      notifySuccess("Attendance added", "The day was recalculated.");
      onSaved(res.day);
    } catch (err) {
      notifyError(err);
      setError(err instanceof ApiError ? (err.errors ? Object.values(err.errors)[0][0] : err.message) : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Add attendance</DialogTitle>
        <DialogDescription>
          Record a day with no scans — for example work on a day off, or a day the scanner was down. It is saved right away and marked as
          adjusted by you.
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSave} className="flex flex-col gap-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_10rem]">
          <div className="flex flex-col gap-2">
            <Label htmlFor="add-employee">Employee</Label>
            <select id="add-employee" required value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} className={SELECT_CLASS}>
              <option value="">{employees ? "Choose an employee" : "Loading…"}</option>
              {employees?.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name}
                  {emp.employee_code ? ` (${emp.employee_code})` : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="add-date">Date</Label>
            <Input id="add-date" type="date" required value={date} max={todayLocal()} onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>

        {existing ? (
          <Alert
            title="This day already has scans"
            action={
              <Button type="button" size="sm" variant="outline" onClick={() => onOpenDay(existing)}>
                Open day
              </Button>
            }
          >
            Open it and use Adjust scans to change or add times.
          </Alert>
        ) : (
          <div className="flex flex-col gap-2">
            <Label>Scans</Label>
            <p className="-mt-1 text-xs text-muted-foreground">
              Every scan of the day, in order. The schedule decides which is an IN and which an OUT; a time earlier than the one before it is
              read as the next morning.
            </p>
            {times.map((time, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="w-12 shrink-0 text-xs font-medium text-muted-foreground">#{i + 1}</span>
                <Input
                  type="time"
                  required
                  aria-label={`Scan ${i + 1}`}
                  value={time}
                  onChange={(e) => setTimes((all) => all.map((t, j) => (j === i ? e.target.value : t)))}
                  className="w-36"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Remove scan ${i + 1}`}
                  disabled={times.length === 1}
                  onClick={() => setTimes((all) => all.filter((_, j) => j !== i))}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="self-start"
              disabled={times.length >= 12}
              onClick={() => setTimes((all) => [...all, ""])}
            >
              <Plus className="size-3.5" />
              Add a scan
            </Button>
          </div>
        )}

        <div className="flex flex-col gap-2">
          <Label htmlFor="add-reason">Reason</Label>
          <Input
            id="add-reason"
            required
            maxLength={255}
            placeholder="e.g. Worked Sunday stock count; confirmed by branch manager"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>

        {error && <Alert variant="destructive">{error}</Alert>}

        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
          <Button type="submit" disabled={saving || !employeeId || existing !== null || filled.length === 0}>
            <CalendarPlus className="size-4" />
            {saving ? "Saving…" : "Add attendance"}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}
