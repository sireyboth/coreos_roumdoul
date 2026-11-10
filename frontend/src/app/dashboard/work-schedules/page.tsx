"use client";

import { useEffect, useState } from "react";
import { CalendarClock, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { AssignScheduleDialog } from "@/components/dashboard/schedules/assign-schedule-dialog";
import { ExcelActions } from "@/components/dashboard/excel/excel-actions";
import { displayOrderColumn } from "@/components/dashboard/shared/display-order";
import { PageHeader } from "@/components/dashboard/layout/page-header";
import { SchedulePeopleDialog } from "@/components/dashboard/schedules/schedule-people-dialog";
import { WorkScheduleCardGrid } from "@/components/dashboard/schedules/work-schedule-card-grid";
import { WorkScheduleDialog } from "@/components/dashboard/schedules/work-schedule-dialog";
import { useMe } from "@/contexts/me-context";
import { api, type WorkSchedule } from "@/lib/api";
import { assignmentImport, exportAssignments, exportWorkSchedules, workScheduleImport } from "@/lib/excel/specs/time";
import { notifyError, notifySuccess } from "@/lib/notify";
import { useT } from "@/lib/i18n";

// Overtime rule labels are schedules.page.overtime.<mode>.

export default function WorkSchedulesPage() {
  const { me } = useMe();
  const t = useT();
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

  // The cards (WorkScheduleCardGrid, via renderRows) draw each schedule. These columns only feed the
  // table's search box and sort menu, so their cells are plain text — they never show on screen.
  const columns: DataTableColumn<WorkSchedule>[] = [
    {
      id: "name",
      header: t("schedules.page.column.schedule"),
      primary: true,
      cell: (s) => s.name,
      sortValue: (s) => s.name,
      searchValue: (s) => [s.name, s.description].filter(Boolean).join(" "),
    },
    displayOrderColumn<WorkSchedule>(),
    { id: "hours", header: t("schedules.page.column.hours"), cell: (s) => s.weekly_minutes, sortValue: (s) => s.weekly_minutes },
    {
      id: "rules",
      header: t("schedules.page.column.rules"),
      cell: (s) => s.late_grace_minutes,
      // By how many minutes late is tolerated.
      sortValue: (s) => s.late_grace_minutes,
      sortLabels: [t("schedules.page.sortStrictest"), t("schedules.page.sortLenient")],
    },
    { id: "people", header: t("schedules.page.column.people"), cell: (s) => s.assigned_count ?? 0, sortValue: (s) => s.assigned_count ?? 0 },
    {
      id: "status",
      header: t("common.field.status"),
      cell: (s) => (s.is_active ? t("common.status.active") : t("common.status.inactive")),
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
          defaultPageSize={12}
          pageSizeOptions={[12, 24, 48]}
          renderRows={(rows) => (
            <WorkScheduleCardGrid
              schedules={rows}
              canManage={canManage}
              canAssign={canAssign}
              canSeePeople={canSeePeople}
              onEdit={openForm}
              onDelete={handleDelete}
              onAssign={setAssigning}
              onPeople={setViewingPeople}
            />
          )}
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
