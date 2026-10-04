"use client";

import { useEffect, useState } from "react";
import { Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { parseDate } from "@/components/dashboard/calendar-shared";
import { api, type ScheduleAssignment, type WorkSchedule } from "@/lib/api";
import { daysOffText } from "@/lib/schedule";
import { cn } from "@/lib/utils";

type View = "current" | "upcoming";

const shortDate = (date: string) => parseDate(date).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

/**
 * Who follows a work schedule: today (the number on the list) and from a
 * later date. People who have left are not counted, like on the list.
 */
export function SchedulePeopleDialog({
  schedule,
  onOpenChange,
}: {
  schedule: WorkSchedule | null;
  onOpenChange: (open: boolean) => void;
}) {
  const [result, setResult] = useState<{ scheduleId: number; rows: ScheduleAssignment[] } | null>(null);
  const [view, setView] = useState<View>("current");
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!schedule) return;
    let cancelled = false;
    api.scheduleAssignments
      .list({ workScheduleId: schedule.id })
      .then((rows) => !cancelled && setResult({ scheduleId: schedule.id, rows }))
      .catch(() => !cancelled && setResult({ scheduleId: schedule.id, rows: [] }));
    return () => {
      cancelled = true;
    };
  }, [schedule]);

  const loaded = schedule !== null && result?.scheduleId === schedule.id;
  const following = loaded ? result.rows.filter((a) => a.employee && !a.employee.has_left) : [];
  const groups: Record<View, ScheduleAssignment[]> = {
    current: following.filter((a) => a.state === "current"),
    upcoming: following.filter((a) => a.state === "upcoming"),
  };

  const query = search.trim().toLowerCase();
  const rows = groups[view]
    .filter((a) => !query || [a.employee?.name, a.employee?.employee_code].some((v) => v?.toLowerCase().includes(query)));

  function handleOpenChange(open: boolean) {
    if (!open) {
      setView("current");
      setSearch("");
    }
    onOpenChange(open);
  }

  return (
    <Dialog open={schedule !== null} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>People on {schedule?.name}</DialogTitle>
          <DialogDescription>
            {loaded
              ? `${groups.current.length} ${groups.current.length === 1 ? "person follows" : "people follow"} it today${
                  groups.upcoming.length ? `, ${groups.upcoming.length} more from a later date` : ""
                }.`
              : "Loading…"}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border border-border bg-card p-0.5" role="tablist">
            {(["current", "upcoming"] as View[]).map((v) => (
              <button
                key={v}
                type="button"
                role="tab"
                aria-selected={view === v}
                onClick={() => setView(v)}
                className={cn(
                  "rounded-md px-3 py-1 text-sm font-medium transition-colors",
                  view === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {v === "current" ? "Today" : "Upcoming"} ({groups[v].length})
              </button>
            ))}
          </div>
          <Input
            placeholder="Search by name or ID…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 min-w-0 flex-1 sm:max-w-56"
          />
        </div>

        {!loaded ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Loading…</p>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center text-sm text-muted-foreground">
            <Users className="size-6" />
            {query ? "Nobody matches that search." : view === "current" ? "Nobody follows this schedule today." : "Nobody starts it later."}
          </div>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {rows.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                <div className="flex min-w-0 flex-col">
                  <span className="truncate font-medium">{a.employee?.name}</span>
                  {a.employee?.employee_code && <span className="text-xs text-muted-foreground">{a.employee.employee_code}</span>}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-0.5 text-xs text-muted-foreground">
                  <span>
                    {view === "upcoming" ? "From " : "Since "}
                    {shortDate(a.effective_from)}
                    {a.effective_to ? ` until ${shortDate(a.effective_to)}` : ""}
                  </span>
                  <Badge variant="outline">Off {daysOffText(a.days_off)}</Badge>
                </div>
              </li>
            ))}
          </ul>
        )}

        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>Close</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
