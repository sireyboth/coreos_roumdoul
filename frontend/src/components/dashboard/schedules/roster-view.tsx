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
import { BulkScheduleDialog } from "@/components/dashboard/schedules/bulk-schedule-dialog";
import { currentMonth, parseDate, shiftMonth } from "@/components/dashboard/schedules/calendar-shared";
import { ExcelActions } from "@/components/dashboard/excel/excel-actions";
import { useApi } from "@/hooks/use-api";
import { useMe } from "@/contexts/me-context";
import { api, ApiError, Employee, Schedule, WorkLocation, WorkSchedule } from "@/lib/api";
import { slotsOn, slotsSummary, weekSummary } from "@/lib/schedule";
import { dateOnly } from "@/lib/date";
import { exportRoster, rosterImport } from "@/lib/excel/specs/time";
import { notifyError, notifySuccess } from "@/lib/notify";
import { dateLocale, translateNow, useLang, useT } from "@/lib/i18n";

/** Edits one existing roster entry. New entries go through the bulk dialog. */
function ScheduleFormDialog({
  schedule,
  employees,
  schedules,
  open,
  onOpenChange,
  onSaved,
}: {
  schedule: Schedule | null;
  employees: Employee[];
  schedules: WorkSchedule[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const t = useT();
  const lang = useLang();
  const [employeeId, setEmployeeId] = useState(schedule ? String(schedule.employee.id) : "");
  const [scheduleId, setScheduleId] = useState(schedule ? String(schedule.work_schedule.id) : "");
  const [date, setDate] = useState(schedule ? dateOnly(schedule.date) : "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Inactive schedules can't be newly picked, but keep the current one visible while editing.
  const selectableSchedules = schedules.filter((s) => s.is_active || s.id === schedule?.work_schedule.id);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    const payload = { employee_id: Number(employeeId), work_schedule_id: Number(scheduleId), date };

    try {
      if (schedule) {
        await api.schedules.update(schedule.id, payload);
        notifySuccess(translateNow("schedules.roster.updated"));
      }
      onOpenChange(false);
      onSaved();
    } catch (err) {
      notifyError(err);
      setError(err instanceof ApiError ? err.message : translateNow("common.message.somethingWrong"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("schedules.roster.editTitle")}</DialogTitle>
          <DialogDescription>{t("schedules.roster.editText")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="employee">{t("common.field.employee")}</Label>
            <select
              id="employee"
              required
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              className="h-9 rounded-md border border-input bg-transparent px-3 text-sm outline-none"
            >
              <option value="" disabled>
                {t("common.field.select")}
              </option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="shift">{t("schedules.roster.schedule")}</Label>
            <select
              id="shift"
              required
              value={scheduleId}
              onChange={(e) => setScheduleId(e.target.value)}
              className="h-9 rounded-md border border-input bg-transparent px-3 text-sm outline-none"
            >
              <option value="" disabled>
                {t("common.field.select")}
              </option>
              {selectableSchedules.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} — {weekSummary(s, lang)}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="date">{t("common.field.date")}</Label>
            <Input id="date" type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          {error && <Alert variant="destructive">{error}</Alert>}
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>{t("common.action.cancel")}</DialogClose>
            <Button type="submit" disabled={saving}>
              {saving ? t("common.message.saving") : t("common.action.saveChanges")}
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
  const t = useT();
  const lang = useLang();
  const confirm = useConfirm();
  const [month, setMonth] = useState(currentMonth);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [workSchedules, setWorkSchedules] = useState<WorkSchedule[]>([]);
  const [locations, setLocations] = useState<WorkLocation[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Schedule | null>(null);
  // Bumped on every open so the forms always start from fresh values.
  const [formKey, setFormKey] = useState(0);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkKey, setBulkKey] = useState(0);

  const employeeId = employee?.id;
  const { data: result, error, reload: loadSchedules } = useApi(() => {
    const first = parseDate(`${month}-01`);
    const last = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();

    return api.schedules.list({ from: `${month}-01`, to: `${month}-${String(last).padStart(2, "0")}`, employeeId });
  }, [month, employeeId]);
  // A month at a time: the API only returns the first 50 entries otherwise, which a roster outgrows in a day.
  const schedules = result?.data ?? (error ? [] : null);
  const truncated = result !== null && result.total > result.data.length;
  const canManage = me?.permissions.includes("schedules.manage") ?? false;

  useEffect(() => {
    // One person's tab already knows who it is; the full roster needs the whole list.
    if (!employee && canManage) api.employees.list().then((res) => setEmployees(res.data)).catch(() => {});
    if (canManage) {
      api.workSchedules.list().then(setWorkSchedules).catch(() => {});
      api.workLocations.list().then((res) => setLocations(res.data)).catch(() => {});
    }
  }, [employee, canManage]);

  function openForm(schedule: Schedule) {
    setEditing(schedule);
    setFormKey((key) => key + 1);
    setFormOpen(true);
  }

  function openBulk() {
    setBulkKey((key) => key + 1);
    setBulkOpen(true);
  }

  async function handleDelete(schedule: Schedule) {
    const ok = await confirm({
      title: t("schedules.roster.removeTitle"),
      description: t("schedules.roster.removeText", { name: schedule.employee.name, date: dateOnly(schedule.date) }),
      confirmLabel: t("common.action.remove"),
      destructive: true,
    });
    if (!ok) return;

    try {
      await api.schedules.remove(schedule.id);
      notifySuccess(translateNow("schedules.roster.removed"));
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
            header: t("common.field.employee"),
            primary: true,
            cell: (schedule: Schedule) => <span className="font-medium">{schedule.employee.name}</span>,
            sortValue: (schedule: Schedule) => schedule.employee.name,
            searchValue: (schedule: Schedule) => schedule.employee.name,
          },
        ]),
    {
      id: "date",
      header: t("common.field.date"),
      primary: Boolean(employee),
      cell: (schedule) => (
        <Badge variant="outline">
          {parseDate(dateOnly(schedule.date)).toLocaleDateString(dateLocale(lang) ?? [], { weekday: "short", day: "numeric", month: "short" })}
        </Badge>
      ),
      sortValue: (schedule) => dateOnly(schedule.date),
    },
    {
      id: "shift",
      header: t("schedules.roster.scheduleThatDay"),
      cell: (schedule) => (
        <div className="flex flex-col">
          <span className="font-medium">{schedule.work_schedule.name}</span>
          <span className="text-xs text-muted-foreground">
            {slotsSummary(slotsOn(schedule.work_schedule, parseDate(dateOnly(schedule.date)).getDay()), lang)}
          </span>
        </div>
      ),
      sortValue: (schedule) => schedule.work_schedule.name,
      searchValue: (schedule) => schedule.work_schedule.name,
    },
    {
      id: "location",
      header: t("schedules.roster.location"),
      hideOnMobile: true,
      cell: (schedule) => <span className="text-muted-foreground">{schedule.work_location?.name ?? t("schedules.roster.ownBranch")}</span>,
      searchValue: (schedule) => schedule.work_location?.name,
      sortValue: (schedule) => schedule.work_location?.name ?? t("schedules.roster.ownBranch"),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="icon" onClick={() => setMonth(shiftMonth(month, -1))} aria-label={t("common.time.previousMonth")}>
          <ChevronLeft className="size-4" />
        </Button>
        <h2 className="min-w-40 text-center text-base font-semibold">
          {parseDate(`${month}-01`).toLocaleDateString(dateLocale(lang), { month: "long", year: "numeric" })}
        </h2>
        <Button variant="outline" size="icon" onClick={() => setMonth(shiftMonth(month, 1))} aria-label={t("common.time.nextMonth")}>
          <ChevronRight className="size-4" />
        </Button>
        <Button variant="outline" onClick={() => setMonth(currentMonth())}>
          {t("common.time.today")}
        </Button>

        <div className="ml-auto flex flex-wrap gap-2">
          <ExcelActions
            onExport={() => exportRoster(month, employee)}
            // One person's schedule tab exports just them; the file import belongs to the whole roster.
            importSpec={canManage && !employee ? rosterImport : undefined}
            onImported={loadSchedules}
          />
          {canManage && (
            <Button onClick={openBulk}>
              <Plus className="size-4" />
              {employee ? t("schedules.roster.scheduleOne", { name: employee.name.split(" ")[0] }) : t("schedules.roster.addToRoster")}
            </Button>
          )}
        </div>
      </div>

      {truncated && result && (
        <Alert variant="warning">
          {t("schedules.roster.truncated", { total: result.total.toLocaleString(), shown: result.data.length.toLocaleString() })}
        </Alert>
      )}

      <DataTable
        data={schedules}
        getRowId={(schedule) => schedule.id}
        columns={columns}
        searchPlaceholder={t("schedules.roster.search")}
        initialSort={{ columnId: "date", direction: "asc" }}
        emptyState={{
          icon: CalendarRange,
          title: t("schedules.roster.emptyTitle"),
          description: canManage
            ? employee
              ? t("schedules.roster.emptyOne", { name: employee.name.split(" ")[0] })
              : t("schedules.roster.emptyAll")
            : t("schedules.roster.emptyViewer"),
        }}
        rowActions={
          canManage
            ? (schedule) => (
                <>
                  <Button variant="outline" size="sm" onClick={() => openForm(schedule)}>
                    <Pencil className="size-3.5" />
                    {t("common.action.edit")}
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => handleDelete(schedule)}>
                    <Trash2 className="size-3.5" />
                    {t("common.action.delete")}
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
        schedules={workSchedules}
        locations={locations}
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        onSaved={loadSchedules}
      />

      <ScheduleFormDialog
        key={formKey}
        schedule={editing}
        employees={employee ? [employee] : employees}
        schedules={workSchedules}
        open={formOpen}
        onOpenChange={setFormOpen}
        onSaved={loadSchedules}
      />
    </div>
  );
}
