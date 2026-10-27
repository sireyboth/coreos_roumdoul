"use client";

import { useEffect, useState } from "react";
import { CheckCheck, ChevronLeft, ChevronRight, ScanLine } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Textarea } from "@/components/ui/textarea";
import { parseDate, shiftMonth } from "@/components/dashboard/calendar-shared";
import { useApi } from "@/hooks/use-api";
import { api, type AttendanceDay } from "@/lib/api";
import { dateLocale, useLang, useT, type Lang } from "@/lib/i18n";
import { notifyError, notifySuccess } from "@/lib/notify";

const ALL = "";

// expected_at / actual_at are written in the company's time zone, so the clock part is the local time.
const clockOf = (iso: string) => iso.slice(11, 16);

const monthLabel = (month: string, lang: Lang) =>
  parseDate(`${month}-01`).toLocaleDateString(dateLocale(lang), { month: "long", year: "numeric" });

function monthRange(month: string): { from: string; to: string } {
  const [year, m] = month.split("-").map(Number);
  const last = new Date(year, m, 0).getDate();
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, "0")}` };
}

/** "IN 1", "OUT 1", "IN 2"… for each slot of a day, by sequence. */
function slotLabels(day: AttendanceDay, t: ReturnType<typeof useT>): Map<number, string> {
  const counts = { in: 0, out: 0 };
  return new Map(
    day.slots.map((slot) => [
      slot.sequence,
      t(slot.type === "in" ? "attendance.fillMissed.slotIn" : "attendance.fillMissed.slotOut", { n: ++counts[slot.type] }),
    ]),
  );
}

const isMissing = (slot: AttendanceDay["slots"][number]) => slot.scan_id === null && slot.status === "missing";

/**
 * Everyone's missed scans in one place: pick a person (or everyone) and a
 * month, see each day with a missing IN/OUT, set the times and save — one
 * day at a time or all at once. Saved as admin adjustments with a reason.
 */
export function MissedScansDialog({
  open,
  onOpenChange,
  initialMonth,
  onChanged,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialMonth: string;
  onChanged: () => void;
}) {
  const t = useT();
  const lang = useLang();
  const [month, setMonth] = useState(initialMonth);
  const [employeeId, setEmployeeId] = useState(ALL);
  const [people, setPeople] = useState<{ value: string; label: string }[]>([]);
  // Times typed in, by day id then slot sequence; untouched slots use the schedule.
  const [times, setTimes] = useState<Record<number, Record<number, string>>>({});
  const [reason, setReason] = useState("");
  const [reasonMissing, setReasonMissing] = useState(false);
  const [saving, setSaving] = useState<number | "all" | null>(null);

  const { data, error, reload } = useApi(
    open
      ? () =>
          api.attendance
            .list({ ...monthRange(month), missed: true, per_page: 1000, employee_id: employeeId ? Number(employeeId) : undefined })
            .then((page) => page.data.filter((d) => d.slots.some(isMissing)))
      : null,
    [month, employeeId],
    { notify: true },
  );
  const days = data ?? (error ? [] : null);

  useEffect(() => {
    if (!open) return;
    api.employees
      .all()
      // "All employees" is added at render, so it follows the language.
      .then((list) => setPeople(list.map((e) => ({ value: String(e.id), label: e.name }))))
      .catch(notifyError);
  }, [open]);

  function close(next: boolean) {
    if (!next) {
      setTimes({});
      setReason("");
      setReasonMissing(false);
      setMonth(initialMonth);
      setEmployeeId(ALL);
    }
    onOpenChange(next);
  }

  const timeFor = (day: AttendanceDay, sequence: number, expected: string) => times[day.id]?.[sequence] ?? clockOf(expected);

  /** Only the times that differ from the schedule; null when the schedule is used as is. */
  function customTimes(day: AttendanceDay): Record<number, string> | null {
    const changed = day.slots.filter(isMissing).filter((s) => timeFor(day, s.sequence, s.expected_at) !== clockOf(s.expected_at));
    return changed.length ? Object.fromEntries(changed.map((s) => [s.sequence, timeFor(day, s.sequence, s.expected_at)])) : null;
  }

  async function save(target: AttendanceDay[], which: number | "all") {
    if (!reason.trim()) {
      setReasonMissing(true);
      return;
    }
    setSaving(which);
    try {
      // Days sharing the same times go in one request: all on schedule, or the same edits.
      const groups = new Map<string, { ids: number[]; times: Record<number, string> | null }>();
      for (const day of target) {
        const custom = customTimes(day);
        const groupKey = JSON.stringify(custom);
        const group = groups.get(groupKey) ?? { ids: [], times: custom };
        group.ids.push(day.id);
        groups.set(groupKey, group);
      }
      let filled = 0;
      for (const group of groups.values()) {
        filled += (await api.attendance.fillMissed(group.ids, reason.trim(), group.times ?? undefined)).filled;
      }
      notifySuccess(t(filled === 1 ? "attendance.missedScans.savedOne" : "attendance.missedScans.savedOther", { n: filled }), reason.trim());
      reload();
      onChanged();
    } catch (err) {
      notifyError(err);
      reload();
    } finally {
      setSaving(null);
    }
  }

  const showName = employeeId === ALL;

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="flex max-h-[92vh] flex-col gap-4 sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("attendance.missedScans.title")}</DialogTitle>
          <DialogDescription>{t("attendance.missedScans.description")}</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="missed-employee">{t("common.field.employee")}</Label>
            <SearchableSelect
              id="missed-employee"
              options={people.length ? [{ value: ALL, label: t("attendance.missedScans.allEmployees") }, ...people] : people}
              value={employeeId}
              onChange={(value) => setEmployeeId(value ?? ALL)}
              placeholder={t("attendance.missedScans.allEmployees")}
              clearable={false}
              className="h-9 w-full rounded-md"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>{t("common.time.month")}</Label>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setMonth(shiftMonth(month, -1))}
                aria-label={t("common.time.previousMonth")}
              >
                <ChevronLeft className="size-4" />
              </Button>
              <span className="min-w-32 text-center text-sm font-medium">{monthLabel(month, lang)}</span>
              <Button type="button" variant="outline" size="icon" onClick={() => setMonth(shiftMonth(month, 1))} aria-label={t("common.time.nextMonth")}>
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="missed-reason">{t("common.field.reason")}</Label>
          <Textarea
            id="missed-reason"
            rows={2}
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              setReasonMissing(false);
            }}
            placeholder={t("attendance.missedScans.reasonPlaceholder")}
            maxLength={255}
            aria-invalid={reasonMissing || undefined}
          />
          {reasonMissing ? (
            <p className="text-xs text-destructive">{t("attendance.missedScans.reasonMissing")}</p>
          ) : (
            <p className="text-xs text-muted-foreground">{t("attendance.missedScans.reasonHint")}</p>
          )}
        </div>

        <div className="-mx-6 min-h-40 flex-1 overflow-y-auto border-y border-border px-6">
          {days === null ? (
            <p className="py-10 text-center text-sm text-muted-foreground">{t("common.message.loading")}</p>
          ) : days.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <CheckCheck className="size-8 text-success" />
              <p className="font-medium">{t("attendance.missedScans.noneTitle")}</p>
              <p className="text-sm text-muted-foreground">{t("attendance.missedScans.noneHint", { month: monthLabel(month, lang) })}</p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {days.map((day) => {
                const labels = slotLabels(day, t);
                const none = day.scan_count === 0;
                return (
                  <li key={day.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-end">
                    <div className="flex min-w-0 flex-1 flex-col gap-3">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        {showName && <span className="font-medium">{day.employee?.name}</span>}
                        <span className={showName ? "text-sm text-muted-foreground" : "font-medium"}>
                          {parseDate(day.date).toLocaleDateString(dateLocale(lang), { weekday: "short", day: "numeric", month: "short" })}
                        </span>
                        {day.schedule && <span className="text-xs text-muted-foreground">· {day.schedule}</span>}
                        <Badge variant={none ? "destructive" : "warning"}>
                          {none ? t("attendance.missedScans.noScans") : t("attendance.missedScans.missingScan")}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                        {day.slots.map((slot) => (
                          <div key={slot.sequence} className="flex flex-col gap-1">
                            <span className="text-xs text-muted-foreground">{labels.get(slot.sequence)}</span>
                            {isMissing(slot) ? (
                              <Input
                                type="time"
                                aria-label={t("attendance.missedScans.slotTime", { slot: labels.get(slot.sequence) ?? "" })}
                                value={timeFor(day, slot.sequence, slot.expected_at)}
                                onChange={(e) =>
                                  setTimes((all) => ({ ...all, [day.id]: { ...all[day.id], [slot.sequence]: e.target.value } }))
                                }
                              />
                            ) : (
                              <span className="flex h-8 items-center gap-1.5 rounded-lg bg-muted/50 px-2.5 text-sm tabular-nums">
                                <ScanLine className="size-3.5 text-muted-foreground" />
                                {slot.actual_at ? clockOf(slot.actual_at) : "—"}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                    <Button type="button" variant="outline" size="sm" disabled={saving !== null} onClick={() => save([day], day.id)}>
                      {saving === day.id ? t("attendance.missedScans.saving") : t("common.action.save")}
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <DialogFooter className="sm:items-center">
          <p className="text-xs text-muted-foreground sm:mr-auto">{t("attendance.missedScans.footerHint")}</p>
          <Button type="button" disabled={!days?.length || saving !== null} onClick={() => days && save(days, "all")}>
            {saving === "all"
              ? t("attendance.missedScans.saving")
              : days?.length
                ? t("attendance.missedScans.saveAllCount", { n: days.length })
                : t("attendance.missedScans.saveAll")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
