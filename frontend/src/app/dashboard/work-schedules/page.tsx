"use client";

import { useEffect, useState } from "react";
import { CalendarClock, Pencil, Plus, Trash2, UserPlus, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { AssignScheduleDialog } from "@/components/dashboard/schedules/assign-schedule-dialog";
import { ExcelActions } from "@/components/dashboard/excel/excel-actions";
import { displayOrderColumn } from "@/components/dashboard/shared/display-order";
import { PageHeader } from "@/components/dashboard/layout/page-header";
import { SchedulePeopleDialog } from "@/components/dashboard/schedules/schedule-people-dialog";
import { WorkScheduleDialog } from "@/components/dashboard/schedules/work-schedule-dialog";
import { useMe } from "@/contexts/me-context";
import { api, type WorkSchedule } from "@/lib/api";
import { assignmentImport, exportAssignments, exportWorkSchedules, workScheduleImport } from "@/lib/excel/specs/time";
import { notifyError, notifySuccess } from "@/lib/notify";
import { daysOffText, formatMinutes, slotsOn, WEEK_ORDER, weekdayShort, slotsSummary } from "@/lib/schedule";
import { useLang, useT } from "@/lib/i18n";

// Overtime rule labels are schedules.page.overtime.<mode>.

/** The week as a compact grid: one cell per day, Monday first. */
function WeekStrip({ schedule }: { schedule: WorkSchedule }) {
  const t = useT();
  const lang = useLang();
  return (
    <div className="grid grid-cols-7 gap-0.5">
      {WEEK_ORDER.map((weekday) => {
        const slots = slotsOn(schedule, weekday);
        const stretches = slots.length / 2;
        return (
          <div
            key={weekday}
            title={`${weekdayShort(weekday, lang)}: ${slotsSummary(slots, lang)}`}
            className={
              slots.length === 0
                ? "rounded border border-dashed border-border px-0.5 py-0.5 text-center text-[10px] leading-tight text-muted-foreground"
                : "rounded border border-primary/25 bg-primary/8 px-0.5 py-0.5 text-center text-[10px] leading-tight font-medium text-primary"
            }
          >
            <div className="whitespace-nowrap">{weekdayShort(weekday, lang)}</div>
            <div className="whitespace-nowrap font-normal tabular-nums opacity-80">{slots.length === 0 ? t("schedules.page.dayOff") : stretches > 1 ? `${stretches}×` : slots[0].time.slice(0, 5)}</div>
          </div>
        );
      })}
    </div>
  );
}

export default function WorkSchedulesPage() {
  const { me } = useMe();
  const t = useT();
  const lang = useLang();
  const confirm = useConfirm();
  const [schedules, setSchedules] = useState<WorkSchedule[] | null>(null);
  const [editing, setEditing] = useState<WorkSchedule | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  // Bumped on every open so the form always starts from fresh values.
  const [formKey, setFormKey] = useState(0);
  const [assigning, setAssigning] = useState<WorkSchedule | null>(null);
  const [viewingPeople, setViewingPeople] = useState<WorkSchedule | null>(null);

  const canManage = me?.permissions.includes("work_schedules.manage") ?? false;
  const canAssign = me?.permissions.includes("schedules.manage") ?? false;
  // Who follows a schedule comes from the assignments, which need the roster permission.
  const canSeePeople = me?.permissions.includes("schedules.view") ?? false;

  function load() {
    api.workSchedules.list().then(setSchedules).catch(() => setSchedules([]));
  }

  useEffect(() => {
    load();
  }, []);

  function openForm(schedule: WorkSchedule | null) {
    setEditing(schedule);
    setFormKey((k) => k + 1);
    setFormOpen(true);
  }

  async function handleDelete(schedule: WorkSchedule) {
    const ok = await confirm({
      title: t("schedules.page.deleteTitle", { name: schedule.name }),
      description: t("schedules.page.deleteText"),
      destructive: true,
    });
    if (!ok) return;

    try {
      await api.workSchedules.remove(schedule.id);
      notifySuccess(t("schedules.page.deleted", { name: schedule.name }));
    } catch (err) {
      notifyError(err);
    }
    load();
  }

  const columns: DataTableColumn<WorkSchedule>[] = [
    {
      id: "name",
      header: t("schedules.page.column.schedule"),
      primary: true,
      cell: (s) => (
        <div className="flex min-w-0 flex-col">
          <span className="font-medium">{s.name}</span>
          {s.description && <span className="truncate text-xs text-muted-foreground">{s.description}</span>}
        </div>
      ),
      sortValue: (s) => s.name,
      searchValue: (s) => [s.name, s.description].filter(Boolean).join(" "),
    },
    displayOrderColumn<WorkSchedule>(),
    {
      id: "week",
      header: t("schedules.page.column.week"),
      cell: (s) => <WeekStrip schedule={s} />,
      className: "min-w-56",
      fullWidthOnMobile: true,
    },
    {
      id: "hours",
      header: t("schedules.page.column.hours"),
      cell: (s) => <span className="tabular-nums">{formatMinutes(s.weekly_minutes, lang)}</span>,
      sortValue: (s) => s.weekly_minutes,
    },
    {
      id: "rules",
      header: t("schedules.page.column.rules"),
      cell: (s) => (
        <div className="flex flex-col text-xs text-muted-foreground">
          <span>{t("schedules.page.lateAfter", { n: s.late_grace_minutes })}</span>
          <span>{t(`schedules.page.overtime.${s.overtime_mode}`)}{s.overtime_mode !== "off" && s.overtime_requires_approval ? t("schedules.page.needsApproval") : ""}</span>
        </div>
      ),
      hideOnMobile: true,
      // By how many minutes late is tolerated.
      sortValue: (s) => s.late_grace_minutes,
      sortLabels: [t("schedules.page.sortStrictest"), t("schedules.page.sortLenient")],
    },
    {
      id: "people",
      header: t("schedules.page.column.people"),
      cell: (s) => (
        <div className="flex flex-col text-xs">
          <span className="font-medium tabular-nums text-foreground">{s.assigned_count ?? 0}</span>
          <span className="whitespace-nowrap text-muted-foreground">{t("schedules.page.offDays", { days: daysOffText(s.default_days_off, lang) })}</span>
        </div>
      ),
      sortValue: (s) => s.assigned_count ?? 0,
    },
    {
      id: "status",
      header: t("common.field.status"),
      cell: (s) => <Badge variant={s.is_active ? "success" : "secondary"}>{s.is_active ? t("common.status.active") : t("common.status.inactive")}</Badge>,
      sortValue: (s) => (s.is_active ? 1 : 0),
      sortLabels: [t("schedules.page.sortInactive"), t("schedules.page.sortActive")],
    },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex w-full flex-col gap-6">
        <PageHeader
          title={t("schedules.page.title")}
          description={t("schedules.page.description")}
          action={
            <div className="flex flex-wrap gap-2">
              <ExcelActions onExport={exportWorkSchedules} importSpec={canManage ? workScheduleImport : undefined} onImported={load} />
              {/* Who follows which schedule, from when — the bulk version of "Assign". */}
              <ExcelActions
                subject={t("schedules.page.assignments")}
                onExport={exportAssignments}
                importSpec={canAssign ? assignmentImport : undefined}
                onImported={load}
              />
              {canManage && (
                <Button onClick={() => openForm(null)}>
                  <Plus className="size-4" />
                  {t("schedules.page.newSchedule")}
                </Button>
              )}
            </div>
          }
        />

        <DataTable
          data={schedules}
          getRowId={(s) => s.id}
          columns={columns}
          searchPlaceholder={t("schedules.page.search")}
          emptyState={{
            icon: CalendarClock,
            title: t("schedules.page.emptyTitle"),
            description: t("schedules.page.emptyText"),
            action: canManage ? (
              <Button onClick={() => openForm(null)}>
                <Plus className="size-4" />
                {t("schedules.page.newSchedule")}
              </Button>
            ) : undefined,
          }}
          rowActions={
            canManage || canAssign || canSeePeople
              ? (s) => (
                  <>
                    {canSeePeople && (
                      <Button variant="outline" size="sm" onClick={() => setViewingPeople(s)}>
                        <Users className="size-3.5" />
                        {t("schedules.page.people", { n: s.assigned_count ?? 0 })}
                      </Button>
                    )}
                    {canAssign && s.is_active && (
                      <Button variant="outline" size="sm" onClick={() => setAssigning(s)}>
                        <UserPlus className="size-3.5" />
                        {t("schedules.page.assign")}
                      </Button>
                    )}
                    {canManage && (
                      <Button variant="outline" size="sm" onClick={() => openForm(s)}>
                        <Pencil className="size-3.5" />
                        {t("common.action.edit")}
                      </Button>
                    )}
                    {canManage && (
                      <Button variant="destructive" size="sm" onClick={() => handleDelete(s)}>
                        <Trash2 className="size-3.5" />
                        {t("common.action.delete")}
                      </Button>
                    )}
                  </>
                )
              : undefined
          }
        />
      </div>

      <WorkScheduleDialog key={formKey} schedule={editing} open={formOpen} onOpenChange={setFormOpen} onSaved={load} />
      <SchedulePeopleDialog schedule={viewingPeople} onOpenChange={(open) => !open && setViewingPeople(null)} />
      {assigning && (
        <AssignScheduleDialog
          open
          onOpenChange={(open) => !open && setAssigning(null)}
          schedule={assigning}
          onAssigned={load}
        />
      )}
    </div>
  );
}
