"use client";

import { useEffect, useState } from "react";
import { CalendarClock, CalendarX2, Plus, Trash2 } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { AssignScheduleDialog } from "@/components/dashboard/assign-schedule-dialog";
import { parseDate } from "@/components/dashboard/calendar-shared";
import { api, type ScheduleAssignment, type WorkSchedule } from "@/lib/api";
import { notifyError, notifySuccess } from "@/lib/notify";
import { daysOffText, weekSummary } from "@/lib/schedule";
import { cn } from "@/lib/utils";

const formatDay = (date: string) => parseDate(date).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

function todayLocal(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

/**
 * One person's work schedules over time — newest first. Each entry is "from
 * this date (until that date) they follow this schedule, with these days off".
 * Changing someone's schedule adds a new entry; the old one ends the day
 * before, so past attendance keeps being judged by what applied then.
 */
export function EmployeeScheduleAssignments({ employee, canManage }: { employee: { id: number; name: string }; canManage: boolean }) {
  const confirm = useConfirm();
  const [reloads, setReloads] = useState(0);
  const [result, setResult] = useState<{ key: number; data: ScheduleAssignment[] } | null>(null);
  const [schedules, setSchedules] = useState<WorkSchedule[]>([]);
  const [assignOpen, setAssignOpen] = useState(false);
  const assignments = result?.key === reloads ? result.data : null;
  const reload = () => setReloads((n) => n + 1);

  useEffect(() => {
    let cancelled = false;
    api.scheduleAssignments
      .list({ employeeId: employee.id })
      .then((data) => !cancelled && setResult({ key: reloads, data }))
      .catch(() => !cancelled && setResult({ key: reloads, data: [] }));
    return () => {
      cancelled = true;
    };
  }, [employee.id, reloads]);

  // Each schedule's week, for the "what does that mean" line under its name.
  useEffect(() => {
    api.workSchedules.list().then(setSchedules).catch(() => setSchedules([]));
  }, []);

  async function endToday(assignment: ScheduleAssignment) {
    const ok = await confirm({
      title: `Stop "${assignment.work_schedule?.name}" for ${employee.name}?`,
      description: "It ends today. From tomorrow they have no work schedule until you assign another — so no expected hours and no absences.",
      confirmLabel: "End today",
    });
    if (!ok) return;

    try {
      await api.scheduleAssignments.update(assignment.id, { effective_to: todayLocal() });
      notifySuccess("Schedule ended");
      reload();
    } catch (err) {
      notifyError(err);
    }
  }

  async function remove(assignment: ScheduleAssignment) {
    const ok = await confirm({
      title: "Remove this schedule entry?",
      description:
        "Use this to undo a mistake. Days already worked in this period are re-checked as having no schedule. To change someone's schedule from a date, assign the new one instead.",
      confirmLabel: "Remove",
      destructive: true,
    });
    if (!ok) return;

    try {
      await api.scheduleAssignments.remove(assignment.id);
      notifySuccess("Schedule entry removed");
      reload();
    } catch (err) {
      notifyError(err);
    }
  }

  const current = assignments?.find((a) => a.state === "current");

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <CardTitle>Work schedule</CardTitle>
          <CardDescription>
            {current
              ? `Follows "${current.work_schedule?.name}" — off ${daysOffText(current.days_off)}.`
              : "No work schedule right now, so no hours are expected."}
          </CardDescription>
        </div>
        {canManage && (
          <Button onClick={() => setAssignOpen(true)}>
            <Plus className="size-4" />
            {current ? "Change schedule" : "Assign a schedule"}
          </Button>
        )}
      </CardHeader>

      <CardContent>
        {assignments === null ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        ) : assignments.length === 0 ? (
          <Alert variant="info">
            Assign a work schedule so {employee.name.split(" ")[0]}&apos;s scans can be checked against expected hours.
          </Alert>
        ) : (
          <ol className="relative flex flex-col gap-3 border-l border-border pl-5">
            {assignments.map((a) => {
              const schedule = schedules.find((s) => s.id === a.work_schedule?.id);
              return (
                <li key={a.id} className="relative">
                  <span
                    className={cn(
                      "absolute -left-[1.6rem] top-3 flex size-3 rounded-full ring-4 ring-background",
                      a.state === "current" ? "bg-success" : a.state === "upcoming" ? "bg-info" : "bg-muted-foreground/40",
                    )}
                  />
                  <div className={cn("flex flex-wrap items-start justify-between gap-3 rounded-lg border p-3", a.state === "current" ? "border-success/30 bg-success/5" : "border-border")}>
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <CalendarClock className="size-4 text-muted-foreground" />
                        <span className="font-medium">{a.work_schedule?.name ?? "Deleted schedule"}</span>
                        <Badge variant={a.state === "current" ? "success" : a.state === "upcoming" ? "info" : "secondary"} className="capitalize">
                          {a.state}
                        </Badge>
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {formatDay(a.effective_from)} → {a.effective_to ? formatDay(a.effective_to) : "ongoing"} · off {daysOffText(a.days_off)}
                      </span>
                      {schedule && <span className="truncate text-xs text-muted-foreground">{weekSummary(schedule)}</span>}
                    </div>
                    {canManage && a.state !== "ended" && (
                      <div className="flex gap-1.5">
                        {a.state === "current" && !a.effective_to && (
                          <Button variant="outline" size="sm" onClick={() => endToday(a)}>
                            <CalendarX2 className="size-3.5" />
                            End today
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" onClick={() => remove(a)} aria-label="Remove this schedule entry">
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </CardContent>

      {canManage && (
        <AssignScheduleDialog open={assignOpen} onOpenChange={setAssignOpen} employee={employee} onAssigned={reload} />
      )}
    </Card>
  );
}
