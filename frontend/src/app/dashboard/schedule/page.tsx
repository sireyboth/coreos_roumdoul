"use client";

import { useEffect, useState } from "react";
import { CalendarRange, Pencil, Plus, Trash2 } from "lucide-react";
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
import { PageHeader } from "@/components/dashboard/page-header";
import { useMe } from "@/contexts/me-context";
import { api, ApiError, Employee, Schedule, Shift } from "@/lib/api";
import { dateOnly } from "@/lib/date";
import { notifyError, notifySuccess } from "@/lib/notify";

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
      } else {
        await api.schedules.create(payload);
        notifySuccess("Shift scheduled");
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
          <DialogTitle>{schedule ? "Edit roster entry" : "Add to roster"}</DialogTitle>
          <DialogDescription>One employee, one shift, one date.</DialogDescription>
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
              {saving ? "Saving…" : schedule ? "Save changes" : "Add to roster"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function SchedulePage() {
  const { me } = useMe();
  const confirm = useConfirm();
  const [schedules, setSchedules] = useState<Schedule[] | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Schedule | null>(null);
  // Bumped on every open so the form always starts from fresh values.
  const [formKey, setFormKey] = useState(0);

  function loadSchedules() {
    api.schedules.list().then((res) => setSchedules(res.data)).catch(() => setSchedules([]));
  }

  useEffect(() => {
    loadSchedules();
    api.employees.list().then((res) => setEmployees(res.data)).catch(() => {});
    api.shifts.list().then((res) => setShifts(res.data)).catch(() => {});
  }, []);

  function openForm(schedule: Schedule | null) {
    setEditing(schedule);
    setFormKey((key) => key + 1);
    setFormOpen(true);
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

  const canManage = me?.permissions.includes("schedules.manage") ?? false;

  const columns: DataTableColumn<Schedule>[] = [
    {
      id: "employee",
      header: "Employee",
      primary: true,
      cell: (schedule) => <span className="font-medium">{schedule.employee.name}</span>,
      sortValue: (schedule) => schedule.employee.name,
      searchValue: (schedule) => schedule.employee.name,
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
      id: "date",
      header: "Date",
      cell: (schedule) => <Badge variant="outline">{dateOnly(schedule.date)}</Badge>,
      sortValue: (schedule) => dateOnly(schedule.date),
    },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex w-full flex-col gap-6">
        <PageHeader
          title="Schedule"
          description={canManage ? "Assign employees to shifts on specific dates." : "Your upcoming shift assignments."}
          action={
            canManage && (
              <Button onClick={() => openForm(null)}>
                <Plus className="size-4" />
                Add to roster
              </Button>
            )
          }
        />

        <DataTable
          data={schedules}
          getRowId={(schedule) => schedule.id}
          columns={columns}
          searchPlaceholder="Search roster…"
          emptyState={{
            icon: CalendarRange,
            title: "Nothing scheduled yet",
            description: canManage
              ? "Assign your first employee to a shift to build the roster."
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
      </div>

      <ScheduleFormDialog
        key={formKey}
        schedule={editing}
        employees={employees}
        shifts={shifts}
        open={formOpen}
        onOpenChange={setFormOpen}
        onSaved={loadSchedules}
      />
    </div>
  );
}
