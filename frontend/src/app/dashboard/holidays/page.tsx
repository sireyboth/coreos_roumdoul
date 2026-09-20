"use client";

import { useEffect, useState } from "react";
import { PartyPopper, Pencil, Plus, Trash2 } from "lucide-react";
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
import { api, ApiError, Holiday } from "@/lib/api";
import { dateOnly } from "@/lib/date";
import { notifyError, notifySuccess } from "@/lib/notify";

function HolidayFormDialog({
  holiday,
  open,
  onOpenChange,
  onSaved,
}: {
  holiday: Holiday | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(holiday?.name ?? "");
  const [date, setDate] = useState(holiday ? dateOnly(holiday.date) : "");
  const [recurring, setRecurring] = useState(holiday?.is_recurring_yearly ?? false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    const payload = { name, date, is_recurring_yearly: recurring };

    try {
      if (holiday) {
        await api.holidays.update(holiday.id, payload);
        notifySuccess("Holiday updated");
      } else {
        await api.holidays.create(payload);
        notifySuccess("Holiday added");
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
          <DialogTitle>{holiday ? `Edit "${holiday.name}"` : "Add a holiday"}</DialogTitle>
          <DialogDescription>Employees won&apos;t be scheduled on this date.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="date">Date</Label>
            <Input id="date" type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={recurring}
              onChange={(e) => setRecurring(e.target.checked)}
              className="size-4 rounded border-input"
            />
            Repeats every year
          </label>
          {error && <Alert variant="destructive">{error}</Alert>}
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : holiday ? "Save changes" : "Add holiday"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function HolidaysPage() {
  const { me } = useMe();
  const confirm = useConfirm();
  const [holidays, setHolidays] = useState<Holiday[] | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Holiday | null>(null);
  // Bumped on every open so the form always starts from fresh values.
  const [formKey, setFormKey] = useState(0);

  function load() {
    api.holidays.list().then((res) => setHolidays(res.data)).catch(() => setHolidays([]));
  }

  useEffect(() => {
    load();
  }, []);

  function openForm(holiday: Holiday | null) {
    setEditing(holiday);
    setFormKey((key) => key + 1);
    setFormOpen(true);
  }

  async function handleDelete(holiday: Holiday) {
    const ok = await confirm({
      title: `Delete "${holiday.name}"?`,
      description: "It will no longer be treated as a holiday.",
      destructive: true,
    });
    if (!ok) return;

    try {
      await api.holidays.remove(holiday.id);
      notifySuccess(`"${holiday.name}" deleted`);
    } catch (err) {
      notifyError(err);
    }
    load();
  }

  const canManage = me?.permissions.includes("holidays.manage") ?? false;

  const columns: DataTableColumn<Holiday>[] = [
    {
      id: "name",
      header: "Name",
      primary: true,
      cell: (holiday) => <span className="font-medium">{holiday.name}</span>,
      sortValue: (holiday) => holiday.name,
      searchValue: (holiday) => holiday.name,
    },
    {
      id: "date",
      header: "Date",
      cell: (holiday) => <span className="text-muted-foreground">{dateOnly(holiday.date)}</span>,
      sortValue: (holiday) => dateOnly(holiday.date),
    },
    {
      id: "recurs",
      header: "Recurs",
      cell: (holiday) =>
        holiday.is_recurring_yearly ? <Badge variant="outline">Yearly</Badge> : <span className="text-muted-foreground">—</span>,
    },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex w-full flex-col gap-6">
        <PageHeader
          title="Holidays"
          description="Company-wide non-working days."
          action={
            canManage && (
              <Button onClick={() => openForm(null)}>
                <Plus className="size-4" />
                Add holiday
              </Button>
            )
          }
        />

        <DataTable
          data={holidays}
          getRowId={(holiday) => holiday.id}
          columns={columns}
          searchPlaceholder="Search holidays…"
          emptyState={{
            icon: PartyPopper,
            title: "No holidays yet",
            description: "Add your company's public holidays so they're excluded from the roster.",
          }}
          rowActions={
            canManage
              ? (holiday) => (
                  <>
                    <Button variant="outline" size="sm" onClick={() => openForm(holiday)}>
                      <Pencil className="size-3.5" />
                      Edit
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => handleDelete(holiday)}>
                      <Trash2 className="size-3.5" />
                      Delete
                    </Button>
                  </>
                )
              : undefined
          }
        />
      </div>

      <HolidayFormDialog key={formKey} holiday={editing} open={formOpen} onOpenChange={setFormOpen} onSaved={load} />
    </div>
  );
}
