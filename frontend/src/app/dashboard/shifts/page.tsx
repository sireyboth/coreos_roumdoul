"use client";

import { useEffect, useState } from "react";
import { Pencil, Plus, Timer, Trash2 } from "lucide-react";
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
import { api, ApiError, Shift } from "@/lib/api";
import { notifyError, notifySuccess } from "@/lib/notify";

function ShiftFormDialog({
  shift,
  open,
  onOpenChange,
  onSaved,
}: {
  shift: Shift | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(shift?.name ?? "");
  const [startTime, setStartTime] = useState(shift?.start_time.slice(0, 5) ?? "08:00");
  const [endTime, setEndTime] = useState(shift?.end_time.slice(0, 5) ?? "17:00");
  const [breakMinutes, setBreakMinutes] = useState(String(shift?.break_minutes ?? 60));
  const [breakPaid, setBreakPaid] = useState(shift?.is_break_paid ?? false);
  const [graceMinutes, setGraceMinutes] = useState(String(shift?.grace_minutes ?? 0));
  const [active, setActive] = useState(shift?.is_active ?? true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    const payload = {
      name,
      start_time: startTime,
      end_time: endTime,
      break_minutes: Number(breakMinutes),
      is_break_paid: breakPaid,
      grace_minutes: Number(graceMinutes),
      is_active: active,
    };

    try {
      if (shift) {
        await api.shifts.update(shift.id, payload);
        notifySuccess("Shift updated");
      } else {
        await api.shifts.create(payload);
        notifySuccess("Shift created");
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
          <DialogTitle>{shift ? `Edit "${shift.name}"` : "Add a shift"}</DialogTitle>
          <DialogDescription>Define the hours, break, and how late is late for this shift.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="start_time">Start</Label>
              <Input id="start_time" type="time" required value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="end_time">End</Label>
              <Input id="end_time" type="time" required value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="break_minutes">Break (minutes)</Label>
              <Input
                id="break_minutes"
                type="number"
                min={0}
                max={240}
                value={breakMinutes}
                onChange={(e) => setBreakMinutes(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="grace_minutes">Grace period (minutes)</Label>
              <Input
                id="grace_minutes"
                type="number"
                min={0}
                max={60}
                value={graceMinutes}
                onChange={(e) => setGraceMinutes(e.target.value)}
              />
            </div>
          </div>
          <p className="-mt-2 text-xs text-muted-foreground">
            Arriving within the grace period after the start time isn&apos;t counted as late.
          </p>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={breakPaid}
              onChange={(e) => setBreakPaid(e.target.checked)}
              className="size-4 rounded border-input"
            />
            The break is paid (counts as worked time)
          </label>
          {shift && (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
                className="size-4 rounded border-input"
              />
              Active
            </label>
          )}
          {error && <Alert variant="destructive">{error}</Alert>}
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : shift ? "Save changes" : "Add shift"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function ShiftsPage() {
  const { me } = useMe();
  const confirm = useConfirm();
  const [shifts, setShifts] = useState<Shift[] | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Shift | null>(null);
  // Bumped on every open so the form always starts from fresh values.
  const [formKey, setFormKey] = useState(0);

  function load() {
    api.shifts.list().then((res) => setShifts(res.data)).catch(() => setShifts([]));
  }

  useEffect(() => {
    load();
  }, []);

  function openForm(shift: Shift | null) {
    setEditing(shift);
    setFormKey((key) => key + 1);
    setFormOpen(true);
  }

  async function handleDelete(shift: Shift) {
    const ok = await confirm({
      title: `Delete "${shift.name}"?`,
      description:
        "Past attendance keeps its record of this shift. If people are still scheduled on it in the future, you'll need to remove those first — or just deactivate it instead.",
      destructive: true,
    });
    if (!ok) return;

    try {
      await api.shifts.remove(shift.id);
      notifySuccess(`"${shift.name}" deleted`);
    } catch (err) {
      notifyError(err);
    }
    load();
  }

  const canManage = me?.permissions.includes("shifts.manage") ?? false;

  const columns: DataTableColumn<Shift>[] = [
    {
      id: "name",
      header: "Name",
      primary: true,
      cell: (shift) => <span className="font-medium">{shift.name}</span>,
      sortValue: (shift) => shift.name,
      searchValue: (shift) => shift.name,
    },
    {
      id: "hours",
      header: "Hours",
      cell: (shift) => (
        <span className="text-muted-foreground">
          {shift.start_time.slice(0, 5)} – {shift.end_time.slice(0, 5)}
        </span>
      ),
      sortValue: (shift) => shift.start_time,
    },
    {
      id: "break",
      header: "Break",
      cell: (shift) => (
        <span className="text-muted-foreground">
          {shift.break_minutes > 0 ? `${shift.break_minutes} min${shift.is_break_paid ? " (paid)" : ""}` : "—"}
        </span>
      ),
      sortValue: (shift) => shift.break_minutes,
    },
    {
      id: "grace",
      header: "Grace",
      cell: (shift) => (
        <span className="text-muted-foreground">{shift.grace_minutes > 0 ? `${shift.grace_minutes} min` : "—"}</span>
      ),
      sortValue: (shift) => shift.grace_minutes,
    },
    {
      id: "status",
      header: "Status",
      cell: (shift) => (
        <Badge variant={shift.is_active ? "success" : "secondary"}>{shift.is_active ? "Active" : "Inactive"}</Badge>
      ),
      sortValue: (shift) => (shift.is_active ? 1 : 0),
    },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex w-full flex-col gap-6">
        <PageHeader
          title="Shifts"
          description="Reusable start/end times and break rules employees get scheduled onto."
          action={
            canManage && (
              <Button onClick={() => openForm(null)}>
                <Plus className="size-4" />
                Add shift
              </Button>
            )
          }
        />

        <DataTable
          data={shifts}
          getRowId={(shift) => shift.id}
          columns={columns}
          searchPlaceholder="Search shifts…"
          emptyState={{
            icon: Timer,
            title: "No shifts yet",
            description: "Create a shift so you can start building the roster.",
          }}
          rowActions={
            canManage
              ? (shift) => (
                  <>
                    <Button variant="outline" size="sm" onClick={() => openForm(shift)}>
                      <Pencil className="size-3.5" />
                      Edit
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => handleDelete(shift)}>
                      <Trash2 className="size-3.5" />
                      Delete
                    </Button>
                  </>
                )
              : undefined
          }
        />
      </div>

      <ShiftFormDialog key={formKey} shift={editing} open={formOpen} onOpenChange={setFormOpen} onSaved={load} />
    </div>
  );
}
