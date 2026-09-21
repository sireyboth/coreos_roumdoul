"use client";

import { useEffect, useState } from "react";
import { CalendarRange, ChevronLeft, ChevronRight, Pencil, Plus, Trash2 } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
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
import { BulkScheduleDialog } from "@/components/dashboard/bulk-schedule-dialog";
import { currentMonth, parseDate, shiftMonth } from "@/components/dashboard/calendar-shared";
import { useMe } from "@/contexts/me-context";
import { api, ApiError, Employee, Schedule, Shift, WorkLocation } from "@/lib/api";
import { dateOnly } from "@/lib/date";
import { notifyError, notifySuccess } from "@/lib/notify";

/** Edits one existing roster entry. New entries go through the bulk dialog. */
function ScheduleFormDialog({
  schedule,
  employees,
  shifts,
  open,
  onOpenChange,
  onSaved,
}: {
  schedule: Schedule | null;
  employees: Employee[];
  shifts: Shift[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [employeeId, setEmployeeId] = useState(schedule ? String(schedule.employee.id) : "");
  const [shiftId, setShiftId] = useState(schedule ? String(schedule.shift.id) : "");
  const [date, setDate] = useState(schedule ? dateOnly(schedule.date) : "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Inactive shifts can't be newly assigned, but keep the current one visible while editing.
  const selectableShifts = shifts.filter((shift) => shift.is_active || shift.id === schedule?.shift.id);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    const payload = { employee_id: Number(employeeId), shift_id: Number(shiftId), date };

    try {
      if (schedule) {
        await api.schedules.update(schedule.id, payload);
        notifySuccess("Schedule updated");
      }
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit roster entry</DialogTitle>
          <DialogDescription>Change this one employee, shift or date.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="employee">Employee</Label>
            <select
              id="employee"
              required
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              className="h-9 rounded-md border border-input bg-transparent px-3 text-sm outline-none"
            >
              <option value="" disabled>
                Select…
              </option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="shift">Shift</Label>
            <select
              id="shift"
              required
              value={shiftId}
              onChange={(e) => setShiftId(e.target.value)}
              className="h-9 rounded-md border border-input bg-transparent px-3 text-sm outline-none"
            >
              <option value="" disabled>
                Select…
              </option>
              {selectableShifts.map((shift) => (
                <option key={shift.id} value={shift.id}>
                  {shift.name} ({shift.start_time.slice(0, 5)}–{shift.end_time.slice(0, 5)})
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="date">Date</Label>
            <Input id="date" type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          {error && <Alert variant="destructive">{error}</Alert>}
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * The roster for a month: everyone's, or — with `employee` — just one person's.
 * Used by the Roster tab on Employees and by each employee's Schedule tab.
 */
export function RosterView({ employee }: { employee?: Employee }) {
  const { me } = useMe();
  const confirm = useConfirm();
  const [month, setMonth] = useState(currentMonth);
  const [reloads, setReloads] = useState(0);
  const [result, setResult] = useState<{ key: string; data: Schedule[]; total: number } | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [locations, setLocations] = useState<WorkLocation[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Schedule | null>(null);
  // Bumped on every open so the forms always start from fresh values.
  const [formKey, setFormKey] = useState(0);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkKey, setBulkKey] = useState(0);
  const [weeklyOffDays, setWeeklyOffDays] = useState<number[]>([]);

  const employeeId = employee?.id;
  const requestKey = `${employeeId ?? "all"}|${month}|${reloads}`;
  // A month at a time: the API only returns the first 50 entries otherwise, which a roster outgrows in a day.
  const schedules = result?.key === requestKey ? result.data : null;
  const truncated = result?.key === requestKey && result.total > result.data.length;
  const loadSchedules = () => setReloads((n) => n + 1);
  const canManage = me?.permissions.includes("schedules.manage") ?? false;

  useEffect(() => {
    let cancelled = false;
    const first = parseDate(`${month}-01`);
    const last = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();

    api.schedules
      .list({ from: `${month}-01`, to: `${month}-${String(last).padStart(2, "0")}`, employeeId })
      .then((res) => !cancelled && setResult({ key: requestKey, data: res.data, total: res.total }))
      .catch(() => !cancelled && setResult({ key: requestKey, data: [], total: 0 }));

    return () => {
      cancelled = true;
    };
  }, [month, employeeId, requestKey]);

  useEffect(() => {
    // One person's tab already knows who it is; the full roster needs the whole list.
    if (!employee && canManage) api.employees.list().then((res) => setEmployees(res.data)).catch(() => {});
    if (canManage) {
      api.shifts.list().then((res) => setShifts(res.data)).catch(() => {});
      api.workLocations.list().then((res) => setLocations(res.data)).catch(() => {});
    }
  }, [employee, canManage]);

  function openForm(schedule: Schedule) {
    setEditing(schedule);
    setFormKey((key) => key + 1);
    setFormOpen(true);
  }

  async function openBulk() {
    // The company's weekly days off start un-ticked; read fresh so they're current.
    try {
      setWeeklyOffDays((await api.calendar.weeklyOffDays()).weekly_off_days);
    } catch {
      setWeeklyOffDays([]);
    }
    setBulkKey((key) => key + 1);
    setBulkOpen(true);
  }

  async function handleDelete(schedule: Schedule) {
    const ok = await confirm({
      title: "Remove this roster entry?",
      description: `${schedule.employee.name} will no longer be scheduled for ${dateOnly(schedule.date)}.`,
      confirmLabel: "Remove",
      destructive: true,
    });
    if (!ok) return;

    try {
      await api.schedules.remove(schedule.id);
      notifySuccess("Roster entry removed");
    } catch (err) {
      notifyError(err);
    }
    loadSchedules();
  }

  const columns: DataTableColumn<Schedule>[] = [
    ...(employee
      ? []
      : [
          {
            id: "employee",
            header: "Employee",
            primary: true,
            cell: (schedule: Schedule) => <span className="font-medium">{schedule.employee.name}</span>,
            sortValue: (schedule: Schedule) => schedule.employee.name,
            searchValue: (schedule: Schedule) => schedule.employee.name,
          },
        ]),
    {
      id: "date",
      header: "Date",
      primary: Boolean(employee),
      cell: (schedule) => (
        <Badge variant="outline">
          {parseDate(dateOnly(schedule.date)).toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" })}
        </Badge>
      ),
      sortValue: (schedule) => dateOnly(schedule.date),
    },
    {
      id: "shift",
      header: "Shift",
      cell: (schedule) => (
        <span className="text-muted-foreground">
          {schedule.shift.name} ({schedule.shift.start_time.slice(0, 5)}–{schedule.shift.end_time.slice(0, 5)})
        </span>
      ),
      sortValue: (schedule) => schedule.shift.name,
      searchValue: (schedule) => schedule.shift.name,
    },
    {
      id: "location",
      header: "Location",
      hideOnMobile: true,
      cell: (schedule) => <span className="text-muted-foreground">{schedule.work_location?.name ?? "Own branch"}</span>,
      searchValue: (schedule) => schedule.work_location?.name,
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="icon" onClick={() => setMonth(shiftMonth(month, -1))} aria-label="Previous month">
          <ChevronLeft className="size-4" />
        </Button>
        <h2 className="min-w-40 text-center text-base font-semibold">
          {parseDate(`${month}-01`).toLocaleDateString(undefined, { month: "long", year: "numeric" })}
        </h2>
        <Button variant="outline" size="icon" onClick={() => setMonth(shiftMonth(month, 1))} aria-label="Next month">
          <ChevronRight className="size-4" />
        </Button>
        <Button variant="outline" onClick={() => setMonth(currentMonth())}>
          Today
        </Button>

        {canManage && (
          <Button onClick={openBulk} className="ml-auto">
            <Plus className="size-4" />
            {employee ? `Schedule ${employee.name.split(" ")[0]}` : "Add to roster"}
          </Button>
        )}
      </div>

      {truncated && result && (
        <Alert variant="warning">
          This month has {result.total.toLocaleString()} shifts; showing the first {result.data.length.toLocaleString()}. Open a single
          employee to see all of theirs.
        </Alert>
      )}

      <DataTable
        data={schedules}
        getRowId={(schedule) => schedule.id}
        columns={columns}
        searchPlaceholder="Search roster…"
        initialSort={{ columnId: "date", direction: "asc" }}
        emptyState={{
          icon: CalendarRange,
          title: "Nothing scheduled this month",
          description: canManage
            ? employee
              ? `Use “Schedule ${employee.name.split(" ")[0]}” to give them shifts — or pick another month.`
              : "Use “Add to roster” to schedule people for this month — or pick another month."
            : "Check back once you're scheduled.",
        }}
        rowActions={
          canManage
            ? (schedule) => (
                <>
                  <Button variant="outline" size="sm" onClick={() => openForm(schedule)}>
                    <Pencil className="size-3.5" />
                    Edit
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => handleDelete(schedule)}>
                    <Trash2 className="size-3.5" />
                    Delete
                  </Button>
                </>
              )
            : undefined
        }
      />

      <BulkScheduleDialog
        key={`bulk-${bulkKey}`}
        employees={employee ? [employee] : employees}
        fixedEmployee={employee}
        shifts={shifts}
        locations={locations}
        weeklyOffDays={weeklyOffDays}
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        onSaved={loadSchedules}
      />

      <ScheduleFormDialog
        key={formKey}
        schedule={editing}
        employees={employee ? [employee] : employees}
        shifts={shifts}
        open={formOpen}
        onOpenChange={setFormOpen}
        onSaved={loadSchedules}
      />
    </div>
  );
}
