"use client";

import { useEffect, useState } from "react";
import { CalendarClock, Pencil, Plus, Trash2, UserPlus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { AssignScheduleDialog } from "@/components/dashboard/assign-schedule-dialog";
import { ExcelActions } from "@/components/dashboard/excel-actions";
import { PageHeader } from "@/components/dashboard/page-header";
import { WorkScheduleDialog } from "@/components/dashboard/work-schedule-dialog";
import { useMe } from "@/contexts/me-context";
import { api, type WorkSchedule } from "@/lib/api";
import { assignmentImport, exportAssignments, exportWorkSchedules, workScheduleImport } from "@/lib/excel-specs/time";
import { notifyError, notifySuccess } from "@/lib/notify";
import { daysOffText, formatMinutes, slotsOn, WEEK_ORDER, WEEKDAY_SHORT, slotsSummary } from "@/lib/schedule";

const OVERTIME_LABEL: Record<WorkSchedule["overtime_mode"], string> = {
  off: "No overtime",
  after_last_out: "After last OUT",
  above_scheduled: "Above scheduled hours",
};

/** The week as a compact grid: one cell per day, Monday first. */
function WeekStrip({ schedule }: { schedule: WorkSchedule }) {
  return (
    <div className="grid grid-cols-7 gap-0.5">
      {WEEK_ORDER.map((weekday) => {
        const slots = slotsOn(schedule, weekday);
        const stretches = slots.length / 2;
        return (
          <div
            key={weekday}
            title={`${WEEKDAY_SHORT[weekday]}: ${slotsSummary(slots)}`}
            className={
              slots.length === 0
                ? "rounded border border-dashed border-border px-0.5 py-0.5 text-center text-[10px] leading-tight text-muted-foreground"
                : "rounded border border-primary/25 bg-primary/8 px-0.5 py-0.5 text-center text-[10px] leading-tight font-medium text-primary"
            }
          >
            <div>{WEEKDAY_SHORT[weekday]}</div>
            <div className="font-normal opacity-80">{slots.length === 0 ? "off" : stretches > 1 ? `${stretches}×` : slots[0].time.slice(0, 5)}</div>
          </div>
        );
      })}
    </div>
  );
}

export default function WorkSchedulesPage() {
  const { me } = useMe();
  const confirm = useConfirm();
  const [schedules, setSchedules] = useState<WorkSchedule[] | null>(null);
  const [editing, setEditing] = useState<WorkSchedule | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  // Bumped on every open so the form always starts from fresh values.
  const [formKey, setFormKey] = useState(0);
  const [assigning, setAssigning] = useState<WorkSchedule | null>(null);

  const canManage = me?.permissions.includes("work_schedules.manage") ?? false;
  const canAssign = me?.permissions.includes("schedules.manage") ?? false;

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
      title: `Delete "${schedule.name}"?`,
      description:
        "Days already worked keep their own record of these hours. If anyone still follows it, move them to another schedule first — or just set it to inactive.",
      destructive: true,
    });
    if (!ok) return;

    try {
      await api.workSchedules.remove(schedule.id);
      notifySuccess(`"${schedule.name}" deleted`);
    } catch (err) {
      notifyError(err);
    }
    load();
  }

  const columns: DataTableColumn<WorkSchedule>[] = [
    {
      id: "name",
      header: "Schedule",
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
    {
      id: "week",
      header: "Week",
      cell: (s) => <WeekStrip schedule={s} />,
      className: "min-w-56",
    },
    {
      id: "hours",
      header: "Hours / week",
      cell: (s) => <span className="tabular-nums">{formatMinutes(s.weekly_minutes)}</span>,
      sortValue: (s) => s.weekly_minutes,
    },
    {
      id: "rules",
      header: "Rules",
      cell: (s) => (
        <div className="flex flex-col text-xs text-muted-foreground">
          <span>Late after {s.late_grace_minutes} min</span>
          <span>{OVERTIME_LABEL[s.overtime_mode]}{s.overtime_mode !== "off" && s.overtime_requires_approval ? " · needs approval" : ""}</span>
        </div>
      ),
      hideOnMobile: true,
    },
    {
      id: "people",
      header: "People",
      cell: (s) => (
        <div className="flex flex-col text-xs">
          <span className="font-medium tabular-nums text-foreground">{s.assigned_count ?? 0}</span>
          <span className="whitespace-nowrap text-muted-foreground">off {daysOffText(s.default_days_off)}</span>
        </div>
      ),
      sortValue: (s) => s.assigned_count ?? 0,
    },
    {
      id: "status",
      header: "Status",
      cell: (s) => <Badge variant={s.is_active ? "success" : "secondary"}>{s.is_active ? "Active" : "Inactive"}</Badge>,
      sortValue: (s) => (s.is_active ? 1 : 0),
    },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex w-full flex-col gap-6">
        <PageHeader
          title="Work Schedules"
          description="When people should scan in and out — two scans a day or more. Assign a schedule to people from a date; their days off are set per person."
          action={
            <div className="flex flex-wrap gap-2">
              <ExcelActions onExport={exportWorkSchedules} importSpec={canManage ? workScheduleImport : undefined} onImported={load} />
              {/* Who follows which schedule, from when — the bulk version of "Assign". */}
              <ExcelActions
                subject="assignments"
                onExport={exportAssignments}
                importSpec={canAssign ? assignmentImport : undefined}
                onImported={load}
              />
              {canManage && (
                <Button onClick={() => openForm(null)}>
                  <Plus className="size-4" />
                  New schedule
                </Button>
              )}
            </div>
          }
        />

        <DataTable
          data={schedules}
          getRowId={(s) => s.id}
          columns={columns}
          searchPlaceholder="Search schedules…"
          emptyState={{
            icon: CalendarClock,
            title: "No work schedules yet",
            description: "Create one — for example 08:00–17:00, or a split shift 08:00–12:00 and 13:00–17:00 — then assign it to people.",
            action: canManage ? (
              <Button onClick={() => openForm(null)}>
                <Plus className="size-4" />
                New schedule
              </Button>
            ) : undefined,
          }}
          rowActions={
            canManage || canAssign
              ? (s) => (
                  <>
                    {canAssign && s.is_active && (
                      <Button variant="outline" size="sm" onClick={() => setAssigning(s)}>
                        <UserPlus className="size-3.5" />
                        Assign
                      </Button>
                    )}
                    {canManage && (
                      <Button variant="outline" size="sm" onClick={() => openForm(s)}>
                        <Pencil className="size-3.5" />
                        Edit
                      </Button>
                    )}
                    {canManage && (
                      <Button variant="destructive" size="sm" onClick={() => handleDelete(s)}>
                        <Trash2 className="size-3.5" />
                        Delete
                      </Button>
                    )}
                  </>
                )
              : undefined
          }
        />
      </div>

      <WorkScheduleDialog key={formKey} schedule={editing} open={formOpen} onOpenChange={setFormOpen} onSaved={load} />
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
