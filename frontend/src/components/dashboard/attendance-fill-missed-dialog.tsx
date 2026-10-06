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
import { notifyError, notifySuccess } from "@/lib/notify";
import { cn } from "@/lib/utils";

/** Scheduled times already passed with no scan — what the server will fill in. */
function missedSlots(day: AttendanceDay, now: number): number {
  if (day.scans.some((s) => s.method === "auto")) return 0;
  return day.slots.filter((slot) => slot.scan_id === null && new Date(slot.expected_at).getTime() < now).length;
}

// expected_at is written in the company's time zone ("2026-09-21T08:00:00+07:00"), so its clock part is the local time.
const clockOf = (iso: string) => iso.slice(11, 16);

type Position = { sequence: number; label: string; scheduled: string };

/** Every IN/OUT position across the chosen days ("IN 1", "OUT 1", "IN 2"…), with the first scheduled time seen for it. */
function positions(days: AttendanceDay[]): Position[] {
  const bySequence = new Map<number, Position>();
  for (const day of days) {
    const counts = { in: 0, out: 0 };
    for (const slot of day.slots) {
      counts[slot.type]++;
      if (!bySequence.has(slot.sequence)) {
        bySequence.set(slot.sequence, { sequence: slot.sequence, label: `${slot.type.toUpperCase()} ${counts[slot.type]}`, scheduled: clockOf(slot.expected_at) });
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
      notifySuccess(`Missed scans filled on ${filled} ${filled === 1 ? "day" : "days"}`, reason.trim());
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
          <DialogTitle>Fill missed scans</DialogTitle>
          <DialogDescription>Each missed IN or OUT is added for the selected days. Scans people actually made stay as they are.</DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="flex flex-col gap-4">
          {toFill.length > 0 ? (
            <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/40 p-3 text-sm">
              <CalendarCheck className="mt-0.5 size-4 shrink-0 text-primary" />
              <p>
                <span className="font-medium">
                  {scans} {scans === 1 ? "scan" : "scans"}
                </span>{" "}
                will be added across {toFill.length} {toFill.length === 1 ? "day" : "days"} for {people} {people === 1 ? "person" : "people"}.
                {selected.length > toFill.length && (
                  <span className="text-muted-foreground">
                    {" "}
                    {selected.length - toFill.length} selected {selected.length - toFill.length === 1 ? "day has" : "days have"} nothing missing and
                    will be left alone.
                  </span>
                )}
              </p>
            </div>
          ) : (
            <Alert>None of the selected days have a missed scan. Days off, leave, holidays and complete days have nothing to fill.</Alert>
          )}

          {toFill.length > 0 && (
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1 text-sm" role="radiogroup" aria-label="Times to use">
                {[
                  { value: false, label: "Scheduled times" },
                  { value: true, label: "Set times" },
                ].map((option) => (
                  <button
                    key={option.label}
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
                        <Label htmlFor={`fill-${p.sequence}`}>{p.label}</Label>
                        <Input
                          id={`fill-${p.sequence}`}
                          type="time"
                          required
                          value={timeFor(p)}
                          onChange={(e) => setTimes((t) => ({ ...t, [p.sequence]: e.target.value }))}
                        />
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Used only where a scan is missing.
                    {mixedSchedules && " The selected days have different schedules — each time goes to the same IN/OUT position on every day."}
                  </p>
                </>
              ) : (
                <p className="text-xs text-muted-foreground">Each missed scan gets the time its schedule expected, so the day counts as on time.</p>
              )}
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="fill-reason">Reason</Label>
            <Textarea
              id="fill-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Scanner was down all morning"
              maxLength={255}
              required
            />
            <p className="text-xs text-muted-foreground">Shown on each day and in the attendance export.</p>
          </div>

          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
            <Button type="submit" disabled={saving || toFill.length === 0 || !reason.trim()}>
              {saving ? "Filling…" : `Fill ${scans} ${scans === 1 ? "scan" : "scans"}`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
