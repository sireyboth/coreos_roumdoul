"use client";

import { useState } from "react";
import { CalendarCheck } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api, type AttendanceDay } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { notifyError, notifySuccess } from "@/lib/notify";
import { cn } from "@/lib/utils";

/** Scheduled times already passed with no scan — what the server will fill in. */
function missedSlots(day: AttendanceDay, now: number): number {
  if (day.scans.some((s) => s.method === "auto")) return 0;
  return day.slots.filter((slot) => slot.scan_id === null && new Date(slot.expected_at).getTime() < now).length;
}

// expected_at is written in the company's time zone ("2026-09-21T08:00:00+07:00"), so its clock part is the local time.
const clockOf = (iso: string) => iso.slice(11, 16);

// type + n is shown as "IN 1", "OUT 1", "IN 2"…
type Position = { sequence: number; type: "in" | "out"; n: number; scheduled: string };

/** Every IN/OUT position across the chosen days ("IN 1", "OUT 1", "IN 2"…), with the first scheduled time seen for it. */
function positions(days: AttendanceDay[]): Position[] {
  const bySequence = new Map<number, Position>();
  for (const day of days) {
    const counts = { in: 0, out: 0 };
    for (const slot of day.slots) {
      counts[slot.type]++;
      if (!bySequence.has(slot.sequence)) {
        bySequence.set(slot.sequence, { sequence: slot.sequence, type: slot.type, n: counts[slot.type], scheduled: clockOf(slot.expected_at) });
      }
    }
  }
  return [...bySequence.values()].sort((a, b) => a.sequence - b.sequence);
}

/**
 * For days people worked but didn't scan: every missed IN/OUT of the chosen
 * days is added — at the scheduled time, or at times you set — as an admin
 * adjustment with a reason. Real scans stay as they are.
 */
export function AttendanceFillMissedDialog({
  days,
  onOpenChange,
  onDone,
}: {
  days: AttendanceDay[] | null;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}) {
  const t = useT();
  const [reason, setReason] = useState("");
  const [custom, setCustom] = useState(false);
  const [times, setTimes] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState(false);
  const [now] = useState(() => Date.now());

  const selected = days ?? [];
  const toFill = selected.filter((d) => missedSlots(d, now) > 0);
  const scans = toFill.reduce((sum, d) => sum + missedSlots(d, now), 0);
  const people = new Set(toFill.map((d) => d.employee?.id)).size;
  const slots = positions(toFill);
  const mixedSchedules = new Set(toFill.map((d) => d.schedule)).size > 1;
  const timeFor = (p: Position) => times[p.sequence] ?? p.scheduled;

  function close(open: boolean) {
    if (!open) {
      setReason("");
      setCustom(false);
      setTimes({});
    }
    onOpenChange(open);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const { filled } = await api.attendance.fillMissed(
        toFill.map((d) => d.id),
        reason.trim(),
        custom ? Object.fromEntries(slots.map((p) => [p.sequence, timeFor(p)])) : undefined,
      );
      notifySuccess(t(filled === 1 ? "attendance.fillMissed.doneOne" : "attendance.fillMissed.doneOther", { n: filled }), reason.trim());
      onDone();
      close(false);
    } catch (err) {
      notifyError(err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={days !== null} onOpenChange={close}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("attendance.fillMissed.title")}</DialogTitle>
          <DialogDescription>{t("attendance.fillMissed.description")}</DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="flex flex-col gap-4">
          {toFill.length > 0 ? (
            <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/40 p-3 text-sm">
              <CalendarCheck className="mt-0.5 size-4 shrink-0 text-primary" />
              <p>
                <span className="font-medium">{t(scans === 1 ? "attendance.fillMissed.scansOne" : "attendance.fillMissed.scansOther", { n: scans })}</span>{" "}
                {t("attendance.fillMissed.willBeAdded", {
                  days: t(toFill.length === 1 ? "attendance.fillMissed.daysOne" : "attendance.fillMissed.daysOther", { n: toFill.length }),
                  people: t(people === 1 ? "attendance.fillMissed.peopleOne" : "attendance.fillMissed.peopleOther", { n: people }),
                })}
                {selected.length > toFill.length && (
                  <span className="text-muted-foreground">
                    {" "}
                    {t(selected.length - toFill.length === 1 ? "attendance.fillMissed.skippedOne" : "attendance.fillMissed.skippedOther", {
                      n: selected.length - toFill.length,
                    })}
                  </span>
                )}
              </p>
            </div>
          ) : (
            <Alert>{t("attendance.fillMissed.nothingToFill")}</Alert>
          )}

          {toFill.length > 0 && (
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1 text-sm" role="radiogroup" aria-label={t("attendance.fillMissed.timesToUse")}>
                {[
                  { value: false, label: t("attendance.fillMissed.scheduledTimes") },
                  { value: true, label: t("attendance.fillMissed.setTimes") },
                ].map((option) => (
                  <button
                    key={String(option.value)}
                    type="button"
                    role="radio"
                    aria-checked={custom === option.value}
                    onClick={() => setCustom(option.value)}
                    className={cn(
                      "rounded-md px-3 py-1.5 font-medium transition-colors",
                      custom === option.value ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              {custom ? (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    {slots.map((p) => (
                      <div key={p.sequence} className="flex flex-col gap-1.5">
                        <Label htmlFor={`fill-${p.sequence}`}>
                          {t(p.type === "in" ? "attendance.fillMissed.slotIn" : "attendance.fillMissed.slotOut", { n: p.n })}
                        </Label>
                        <Input
                          id={`fill-${p.sequence}`}
                          type="time"
                          required
                          value={timeFor(p)}
                          onChange={(e) => setTimes((all) => ({ ...all, [p.sequence]: e.target.value }))}
                        />
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t("attendance.fillMissed.customHint")}
                    {mixedSchedules && ` ${t("attendance.fillMissed.mixedSchedules")}`}
                  </p>
                </>
              ) : (
                <p className="text-xs text-muted-foreground">{t("attendance.fillMissed.scheduledHint")}</p>
              )}
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="fill-reason">{t("common.field.reason")}</Label>
            <Textarea
              id="fill-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t("attendance.fillMissed.reasonPlaceholder")}
              maxLength={255}
              required
            />
            <p className="text-xs text-muted-foreground">{t("attendance.fillMissed.reasonHint")}</p>
          </div>

          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>{t("common.action.cancel")}</DialogClose>
            <Button type="submit" disabled={saving || toFill.length === 0 || !reason.trim()}>
              {saving
                ? t("attendance.fillMissed.filling")
                : t(scans === 1 ? "attendance.fillMissed.fillOne" : "attendance.fillMissed.fillOther", { n: scans })}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
