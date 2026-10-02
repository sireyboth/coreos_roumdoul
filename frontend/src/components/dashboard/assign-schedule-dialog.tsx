"use client";

import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
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
import { hasLeft } from "@/components/dashboard/employee-form";
import { Skeleton } from "@/components/ui/skeleton";
import { api, ApiError, type Employee, type WorkSchedule } from "@/lib/api";
import { notifyError, notifySuccess } from "@/lib/notify";
import { daysOffText, WEEK_ORDER, WEEKDAY_SHORT, weekSummary } from "@/lib/schedule";
import { cn } from "@/lib/utils";

const SELECT_CLASS = "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none";

function todayLocal(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

/**
 * Puts people on a work schedule from a date. Opened from a schedule (pick
 * the people) or from one employee (pick the schedule). A new assignment
 * takes over from its start date; one with an end date is temporary and the
 * person returns to their usual schedule afterwards.
 */
export function AssignScheduleDialog({
  open,
  onOpenChange,
  schedule,
  employee,
  onAssigned,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Fixed schedule: choose who gets it. */
  schedule?: WorkSchedule;
  /** Fixed person: choose their schedule. */
  employee?: { id: number; name: string };
  onAssigned: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        {/* Mounted only while open, so every visit starts from fresh defaults. */}
        {open && <AssignForm schedule={schedule} employee={employee} onDone={() => onOpenChange(false)} onAssigned={onAssigned} />}
      </DialogContent>
    </Dialog>
  );
}

function AssignForm({
  schedule: fixedSchedule,
  employee,
  onDone,
  onAssigned,
}: {
  schedule?: WorkSchedule;
  employee?: { id: number; name: string };
  onDone: () => void;
  onAssigned: () => void;
}) {
  const [schedules, setSchedules] = useState<WorkSchedule[] | null>(fixedSchedule ? [fixedSchedule] : null);
  const [scheduleId, setScheduleId] = useState(fixedSchedule ? String(fixedSchedule.id) : "");
  const [employees, setEmployees] = useState<Employee[] | null>(employee ? [] : null);
  const [picked, setPicked] = useState<Set<number>>(new Set(employee ? [employee.id] : []));
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState(todayLocal);
  const [temporary, setTemporary] = useState(false);
  const [to, setTo] = useState("");
  const [daysOff, setDaysOff] = useState<number[]>(fixedSchedule?.default_days_off ?? [0]);
  const [error, setError] = useState<string | null>(null);
  const [skipped, setSkipped] = useState<{ name: string; reason: string }[]>([]);
  const [saving, setSaving] = useState(false);

  const schedule = schedules?.find((s) => String(s.id) === scheduleId) ?? null;

  useEffect(() => {
    if (fixedSchedule) return;
    api.workSchedules.list().then((all) => setSchedules(all.filter((s) => s.is_active))).catch(() => setSchedules([]));
  }, [fixedSchedule]);

  useEffect(() => {
    if (employee) return;
    api.employees
      .all()
      .then((all) => setEmployees(all.filter((e) => !hasLeft(e.employment_status)).sort((a, b) => a.name.localeCompare(b.name))))
      .catch(() => setEmployees([]));
  }, [employee]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (employees ?? []).filter((e) =>
      !q || [e.name, e.employee_code, e.branch?.name, e.department?.name].some((v) => v?.toLowerCase().includes(q)),
    );
  }, [employees, search]);

  function chooseSchedule(id: string) {
    setScheduleId(id);
    const chosen = schedules?.find((s) => String(s.id) === id);
    if (chosen) setDaysOff(chosen.default_days_off);
  }

  function toggle(id: number) {
    setPicked((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!schedule || picked.size === 0) return;
    setError(null);
    setSkipped([]);
    setSaving(true);

    const data = {
      work_schedule_id: schedule.id,
      effective_from: from,
      effective_to: temporary && to ? to : null,
      days_off: daysOff,
    };

    try {
      if (employee) {
        await api.scheduleAssignments.create({ ...data, employee_id: employee.id });
        notifySuccess(`${employee.name} now follows "${schedule.name}"`);
        onAssigned();
        onDone();
        return;
      }

      const result = await api.scheduleAssignments.bulk({ ...data, employee_ids: [...picked] });
      onAssigned();
      if (result.skipped.length === 0) {
        notifySuccess(`${result.assigned} ${result.assigned === 1 ? "person now follows" : "people now follow"} "${schedule.name}"`);
        onDone();
      } else {
        // Keep the dialog open so the reasons can be read.
        notifySuccess(`${result.assigned} assigned`, `${result.skipped.length} skipped — see why below.`);
        setSkipped(result.skipped);
        setPicked(new Set(result.skipped.map((s) => s.employee_id)));
      }
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
        <DialogTitle>
          {employee ? `Assign a schedule to ${employee.name}` : `Assign "${fixedSchedule?.name}"`}
        </DialogTitle>
        <DialogDescription>
          From the start date this replaces their current schedule. Days already worked are re-checked against the new
          plan; locked months are never changed.
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        {!fixedSchedule && (
          <div className="flex flex-col gap-2">
            <Label htmlFor="assign-schedule">Work schedule</Label>
            {schedules === null ? (
              <Skeleton className="h-9 w-full" />
            ) : (
              <select id="assign-schedule" required value={scheduleId} onChange={(e) => chooseSchedule(e.target.value)} className={SELECT_CLASS}>
                <option value="" disabled>
                  {schedules.length === 0 ? "No active schedules yet — create one first" : "Select…"}
                </option>
                {schedules.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            )}
            {schedule && <p className="text-xs text-muted-foreground">{weekSummary(schedule)}</p>}
          </div>
        )}

        {!employee && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Label>Employees</Label>
              <span className="text-xs text-muted-foreground">{picked.size} selected</span>
            </div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search name, ID, branch or department…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8" />
            </div>
            <div className="max-h-64 overflow-y-auto rounded-lg border border-border">
              {employees === null ? (
                <div className="flex flex-col gap-2 p-3">
                  {[0, 1, 2].map((i) => (
                    <Skeleton key={i} className="h-9 w-full" />
                  ))}
                </div>
              ) : visible.length === 0 ? (
                <p className="p-6 text-center text-sm text-muted-foreground">No one matches.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {visible.map((e) => (
                    <li key={e.id}>
                      <label className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-muted/50">
                        <input type="checkbox" checked={picked.has(e.id)} onChange={() => toggle(e.id)} className="size-4 rounded border-input" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{e.name}</span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {[e.employee_code, e.branch?.name, e.department?.name].filter(Boolean).join(" · ") || "—"}
                          </span>
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {visible.length > 0 && (
              <div className="flex gap-2">
                <Button type="button" variant="ghost" size="sm" onClick={() => setPicked(new Set([...picked, ...visible.map((e) => e.id)]))}>
                  Select all shown
                </Button>
                {picked.size > 0 && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => setPicked(new Set())}>
                    Clear
                  </Button>
                )}
              </div>
            )}
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="assign-from">Starts on</Label>
            <Input id="assign-from" type="date" required value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="assign-to">Ends on</Label>
            {temporary ? (
              <Input id="assign-to" type="date" required min={from} value={to} onChange={(e) => setTo(e.target.value)} />
            ) : (
              <p className="flex h-9 items-center text-sm text-muted-foreground">Ongoing</p>
            )}
          </div>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input type="checkbox" checked={temporary} onChange={(e) => setTemporary(e.target.checked)} className="size-4 rounded border-input" />
            Temporary — afterwards they go back to their usual schedule
          </label>
        </div>

        <div className="flex flex-col gap-2">
          <Label>Weekly days off</Label>
          <div className="flex flex-wrap gap-1.5">
            {WEEK_ORDER.map((weekday) => (
              <button
                key={weekday}
                type="button"
                aria-pressed={daysOff.includes(weekday)}
                onClick={() => setDaysOff((d) => (d.includes(weekday) ? d.filter((x) => x !== weekday) : [...d, weekday]))}
                className={cn(
                  "h-8 w-12 rounded-md border text-sm font-medium transition-colors",
                  daysOff.includes(weekday) ? "border-primary bg-primary text-primary-foreground" : "border-input hover:bg-muted",
                )}
              >
                {WEEKDAY_SHORT[weekday]}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Off: {daysOffText(daysOff)}. Holidays and one-off days off still apply on top.
          </p>
        </div>

        {skipped.length > 0 && (
          <Alert variant="warning" title="Not assigned">
            <ul className="mt-1 list-disc pl-4">
              {skipped.map((s) => (
                <li key={s.name}>
                  <span className="font-medium">{s.name}</span> — {s.reason}
                </li>
              ))}
            </ul>
          </Alert>
        )}
        {error && <Alert variant="destructive">{error}</Alert>}

        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>{skipped.length > 0 ? "Close" : "Cancel"}</DialogClose>
          <Button type="submit" disabled={saving || !schedule || picked.size === 0 || (temporary && !to)}>
            {saving
              ? "Assigning…"
              : employee || picked.size === 0
                ? "Assign schedule"
                : `Assign to ${picked.size} ${picked.size === 1 ? "person" : "people"}`}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}
