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
import { WEEKDAYS } from "@/components/dashboard/calendar-shared";
import { api, ApiError, Employee, ScheduleBulkInput, ScheduleBulkResult, Shift, WorkLocation } from "@/lib/api";
import { notifyError, notifySuccess } from "@/lib/notify";
import { cn } from "@/lib/utils";

const SELECT_CLASS = "h-9 rounded-md border border-input bg-transparent px-3 text-sm outline-none";
const MAX_DAYS = 93;

// Local calendar date as YYYY-MM-DD (toISOString would shift it to UTC).
function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function parse(date: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Quick ranges. Weeks run Monday to Sunday. */
function range(kind: "this-week" | "next-week" | "this-month" | "next-month"): { from: string; to: string } {
  const now = new Date();
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7));

  if (kind === "this-week" || kind === "next-week") {
    const start = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + (kind === "next-week" ? 7 : 0));
    return { from: iso(start), to: iso(new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6)) };
  }

  const offset = kind === "next-month" ? 1 : 0;
  return {
    from: iso(new Date(now.getFullYear(), now.getMonth() + offset, 1)),
    to: iso(new Date(now.getFullYear(), now.getMonth() + offset + 1, 0)),
  };
}

const QUICK_RANGES = [
  { id: "this-week", label: "This week" },
  { id: "next-week", label: "Next week" },
  { id: "this-month", label: "This month" },
  { id: "next-month", label: "Next month" },
] as const;

function skippedText(skipped: ScheduleBulkResult["skipped"]): string {
  return [
    skipped.holiday > 0 && `${skipped.holiday} on holidays`,
    skipped.day_off > 0 && `${skipped.day_off} on days off`,
    skipped.already_scheduled > 0 && `${skipped.already_scheduled} already scheduled`,
    skipped.employee_left > 0 && `${skipped.employee_left} for people who have left`,
  ]
    .filter(Boolean)
    .join(", ");
}

/**
 * Roster many people over a date range in one step: pick employees, a shift,
 * a range and the weekdays. A live preview asks the server what would really
 * be created, so holidays, days off and existing entries are accounted for.
 */
export function BulkScheduleDialog({
  employees,
  fixedEmployee,
  shifts,
  locations,
  weeklyOffDays,
  open,
  onOpenChange,
  onSaved,
}: {
  employees: Employee[];
  // Set when scheduling one specific person (from their own page): no picker is shown.
  fixedEmployee?: Employee;
  shifts: Shift[];
  locations: WorkLocation[];
  // The company's regular days off — left un-ticked by default.
  weeklyOffDays: number[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const roster = useMemo(() => employees.filter((e) => e.employment_status !== "terminated"), [employees]);
  const activeShifts = useMemo(() => shifts.filter((s) => s.is_active), [shifts]);

  const [picked, setPicked] = useState<Set<number>>(() => new Set(fixedEmployee ? [fixedEmployee.id] : []));
  const [search, setSearch] = useState("");
  const [shiftId, setShiftId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [dates, setDates] = useState(() => range("this-week"));
  const [weekdays, setWeekdays] = useState<number[]>(() => [0, 1, 2, 3, 4, 5, 6].filter((d) => !weeklyOffDays.includes(d)));
  const [skipHolidays, setSkipHolidays] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<{ key: string; data: ScheduleBulkResult | null; error: string | null } | null>(null);

  const term = search.trim().toLowerCase();
  const shown = roster.filter((e) => !term || [e.name, e.employee_code, e.job_title].some((v) => v?.toLowerCase().includes(term)));
  const allShownPicked = shown.length > 0 && shown.every((e) => picked.has(e.id));

  const days = dates.from && dates.to && dates.to >= dates.from ? Math.round((parse(dates.to).getTime() - parse(dates.from).getTime()) / 86_400_000) + 1 : 0;
  const rangeProblem =
    !dates.from || !dates.to
      ? "Pick a start and an end date."
      : dates.to < dates.from
        ? "The end date is before the start date."
        : days > MAX_DAYS
          ? `Pick at most ${MAX_DAYS} days at a time.`
          : weekdays.length === 0
            ? "Tick at least one day of the week."
            : null;

  const payload: ScheduleBulkInput | null =
    picked.size > 0 && shiftId && !rangeProblem
      ? {
          employee_ids: [...picked],
          shift_id: Number(shiftId),
          work_location_id: locationId ? Number(locationId) : null,
          from: dates.from,
          to: dates.to,
          weekdays,
          skip_holidays: skipHolidays,
        }
      : null;
  const previewKey = payload ? JSON.stringify(payload) : "";

  // Ask the server what this would do (without doing it), shortly after the last change.
  useEffect(() => {
    if (!payload) return;
    let cancelled = false;

    const timer = setTimeout(() => {
      api.schedules
        .bulk({ ...payload, dry_run: true })
        .then((data) => !cancelled && setPreview({ key: previewKey, data, error: null }))
        .catch((err) => !cancelled && setPreview({ key: previewKey, data: null, error: err instanceof ApiError ? err.message : "Couldn't check that." }));
    }, 350);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // payload is derived from previewKey, which is what actually changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewKey]);

  const previewReady = payload !== null && preview?.key === previewKey;
  const result = previewReady ? preview.data : null;

  function toggleEmployee(id: number) {
    setPicked((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllShown() {
    setPicked((current) => {
      const next = new Set(current);
      for (const e of shown) {
        if (allShownPicked) next.delete(e.id);
        else next.add(e.id);
      }
      return next;
    });
  }

  function toggleWeekday(day: number) {
    setWeekdays((current) => (current.includes(day) ? current.filter((d) => d !== day) : [...current, day].sort()));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!payload) return;
    setError(null);
    setSaving(true);

    try {
      const res = await api.schedules.bulk(payload);
      const skipped = skippedText(res.skipped);
      notifySuccess(
        `${res.created} ${res.created === 1 ? "shift" : "shifts"} scheduled`,
        skipped ? `Skipped: ${skipped}.` : undefined,
      );
      onOpenChange(false);
      onSaved();
    } catch (err) {
      notifyError(err);
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Add to roster</DialogTitle>
          <DialogDescription>
            {fixedEmployee
              ? `Pick a shift and a date range. ${fixedEmployee.name} gets the shift on each chosen weekday in the range. A single day works too — set both dates the same.`
              : "Pick people, a shift and a date range. Every chosen person gets the shift on each chosen weekday in the range. A single day works too — just set both dates the same."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div className={cn("grid gap-5", !fixedEmployee && "md:grid-cols-2")}>
            {/* People */}
            {!fixedEmployee && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <Label>Employees</Label>
                <span className="text-xs text-muted-foreground">{picked.size} selected</span>
              </div>
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search…"
                  aria-label="Search employees"
                  className="pl-8"
                />
              </div>
              <div className="max-h-64 overflow-y-auto rounded-lg border border-border">
                <label className="flex cursor-pointer items-center gap-2.5 border-b border-border bg-muted/50 px-3 py-2 text-sm font-medium">
                  <input type="checkbox" checked={allShownPicked} onChange={toggleAllShown} className="size-4 rounded border-input" />
                  {term ? "Select everyone shown" : "Select everyone"}
                </label>
                {shown.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">No one matches.</p>}
                <ul className="divide-y divide-border">
                  {shown.map((employee) => (
                    <li key={employee.id}>
                      <label className="flex cursor-pointer items-center gap-2.5 px-3 py-2 text-sm hover:bg-muted/50">
                        <input
                          type="checkbox"
                          checked={picked.has(employee.id)}
                          onChange={() => toggleEmployee(employee.id)}
                          className="size-4 rounded border-input"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">{employee.name}</span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {[employee.job_title, employee.department?.name, employee.branch?.name].filter(Boolean).join(" · ") || "—"}
                          </span>
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            )}

            {/* What and when */}
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="bulk-shift">Shift</Label>
                <select id="bulk-shift" required value={shiftId} onChange={(e) => setShiftId(e.target.value)} className={SELECT_CLASS}>
                  <option value="" disabled>
                    Select…
                  </option>
                  {activeShifts.map((shift) => (
                    <option key={shift.id} value={shift.id}>
                      {shift.name} ({shift.start_time.slice(0, 5)}–{shift.end_time.slice(0, 5)})
                    </option>
                  ))}
                </select>
              </div>

              {locations.length > 0 && (
                <div className="flex flex-col gap-2">
                  <Label htmlFor="bulk-location">Work location (optional)</Label>
                  <select id="bulk-location" value={locationId} onChange={(e) => setLocationId(e.target.value)} className={SELECT_CLASS}>
                    <option value="">Their own branch</option>
                    {locations.map((location) => (
                      <option key={location.id} value={location.id}>
                        {location.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground">Only set this to send people to a different site.</p>
                </div>
              )}

              <div className="flex flex-col gap-2">
                <Label>Dates</Label>
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_RANGES.map((quick) => (
                    <Button key={quick.id} type="button" variant="outline" size="sm" onClick={() => setDates(range(quick.id))}>
                      {quick.label}
                    </Button>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="bulk-from" className="text-xs text-muted-foreground">
                      From
                    </Label>
                    <Input id="bulk-from" type="date" required value={dates.from} onChange={(e) => setDates({ ...dates, from: e.target.value })} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="bulk-to" className="text-xs text-muted-foreground">
                      To
                    </Label>
                    <Input id="bulk-to" type="date" required value={dates.to} min={dates.from} onChange={(e) => setDates({ ...dates, to: e.target.value })} />
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <Label>Days of the week</Label>
                <div className="grid grid-cols-7 gap-1">
                  {WEEKDAYS.map((name, index) => (
                    <button
                      key={name}
                      type="button"
                      aria-pressed={weekdays.includes(index)}
                      onClick={() => toggleWeekday(index)}
                      className={cn(
                        "rounded-md border px-1 py-1.5 text-xs font-medium transition-colors",
                        weekdays.includes(index) ? "border-primary bg-primary/10 text-primary" : "border-input text-muted-foreground hover:bg-muted",
                      )}
                    >
                      {name}
                    </button>
                  ))}
                </div>
                {weeklyOffDays.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Your company&apos;s weekly days off ({weeklyOffDays.map((d) => WEEKDAYS[d]).join(", ")}) start un-ticked.
                  </p>
                )}
              </div>

              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={skipHolidays} onChange={(e) => setSkipHolidays(e.target.checked)} className="size-4 rounded border-input" />
                Skip public holidays
              </label>
            </div>
          </div>

          {/* Live preview */}
          <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
            {rangeProblem && picked.size > 0 && shiftId ? (
              <span className="text-destructive">{rangeProblem}</span>
            ) : !payload ? (
              <span className="text-muted-foreground">Pick at least one employee and a shift to see what will be created.</span>
            ) : !previewReady ? (
              <span className="text-muted-foreground">Checking…</span>
            ) : preview?.error ? (
              <span className="text-destructive">{preview.error}</span>
            ) : result ? (
              <span>
                <strong>{result.created}</strong> {result.created === 1 ? "shift" : "shifts"} will be created
                {skippedText(result.skipped) && <span className="text-muted-foreground"> · skipping {skippedText(result.skipped)}</span>}
              </span>
            ) : null}
          </div>

          {error && <Alert variant="destructive">{error}</Alert>}
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
            <Button type="submit" disabled={saving || !previewReady || !result || result.created === 0}>
              {saving ? "Scheduling…" : result ? `Schedule ${result.created} ${result.created === 1 ? "shift" : "shifts"}` : "Schedule"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
