"use client";

import { useEffect, useState } from "react";
import { CalendarRange, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/dashboard/empty-state";
import { PageHeader } from "@/components/dashboard/page-header";
import { useMe } from "@/contexts/me-context";
import { api, ApiError, Employee, Schedule, Shift } from "@/lib/api";
import { Alert } from "@/components/ui/alert";
import { notifyError, notifySuccess } from "@/lib/notify";

export default function SchedulePage() {
  const { me } = useMe();
  const [schedules, setSchedules] = useState<Schedule[] | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [open, setOpen] = useState(false);
  const [employeeId, setEmployeeId] = useState("");
  const [shiftId, setShiftId] = useState("");
  const [date, setDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function loadSchedules() {
    api.schedules.list().then((res) => setSchedules(res.data)).catch(() => setSchedules([]));
  }

  useEffect(() => {
    loadSchedules();
    api.employees.list().then((res) => setEmployees(res.data)).catch(() => {});
    api.shifts.list().then((res) => setShifts(res.data)).catch(() => {});
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    try {
      await api.schedules.create({ employee_id: Number(employeeId), shift_id: Number(shiftId), date });
      notifySuccess("Shift scheduled");
      setDate("");
      setOpen(false);
      loadSchedules();
    } catch (err) {
      notifyError(err);
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove(schedule: Schedule) {
    if (!confirm(`Remove this schedule entry?`)) return;
    try {
      await api.schedules.remove(schedule.id);
      notifySuccess("Schedule entry removed");
    } catch (err) {
      notifyError(err);
      notifyError(err);
    }
    loadSchedules();
  }

  const canManage = me?.permissions.includes("schedules.manage") ?? false;

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex w-full flex-col gap-6">
        <PageHeader
          title="Schedule"
          description={canManage ? "Assign employees to shifts on specific dates." : "Your upcoming shift assignments."}
          action={
            canManage && (
              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger
                  render={
                    <Button>
                      <Plus className="size-4" />
                      Add to roster
                    </Button>
                  }
                />
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add to roster</DialogTitle>
                    <DialogDescription>One employee, one shift, one date.</DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleCreate} className="flex flex-col gap-4">
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
                        {shifts.map((shift) => (
                          <option key={shift.id} value={shift.id}>
                            {shift.name} ({shift.start_time.slice(0, 5)}–{shift.end_time.slice(0, 5)})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="date">Date</Label>
                      <Input
                        id="date"
                        type="date"
                        required
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                      />
                    </div>
                    {error && <Alert variant="destructive">{error}</Alert>}
                    <DialogFooter>
                      <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
                      <Button type="submit" disabled={saving}>
                        {saving ? "Adding…" : "Add to roster"}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            )
          }
        />

        {schedules === null && <p className="text-sm text-muted-foreground">Loading…</p>}

        {schedules?.length === 0 && (
          <EmptyState
            icon={CalendarRange}
            title="Nothing scheduled yet"
            description={
              canManage ? "Assign your first employee to a shift to build the roster." : "Check back once you're scheduled."
            }
          />
        )}

        {schedules && schedules.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Shift</TableHead>
                <TableHead>Date</TableHead>
                {canManage && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {schedules.map((schedule) => (
                <TableRow key={schedule.id}>
                  <TableCell className="font-medium">{schedule.employee.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {schedule.shift.name} ({schedule.shift.start_time.slice(0, 5)}–
                    {schedule.shift.end_time.slice(0, 5)})
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{schedule.date}</Badge>
                  </TableCell>
                  {canManage && (
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" onClick={() => handleRemove(schedule)}>
                        Remove
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
