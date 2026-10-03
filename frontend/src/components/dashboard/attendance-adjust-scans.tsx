"use client";

import { useState } from "react";
import { Plus, RotateCcw, Trash2 } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, ApiError, type AttendanceDay } from "@/lib/api";
import { notifyError, notifySuccess } from "@/lib/notify";
import { cn } from "@/lib/utils";

type Row = {
  // Set for a scan already on the day; a new row has none.
  scanId: number | null;
  role: string | null;
  // "2026-10-05T08:00" on the company's clock — what a datetime-local input holds.
  original: string;
  value: string;
  removed: boolean;
};

/** The scan's wall-clock time as the API sent it ("…T08:00:00+07:00" → "…T08:00"). */
const local = (iso: string) => iso.slice(0, 16);

/**
 * An admin's direct fix to one day: change a scan's time, remove a wrong one,
 * add a missing one. Nothing is erased — a changed or removed scan is voided
 * (kept with the reason) and the right time added as an adjustment, then the
 * day is recalculated.
 */
export function AttendanceAdjustScans({
  day,
  onCancel,
  onSaved,
}: {
  day: AttendanceDay;
  onCancel: () => void;
  onSaved: (day: AttendanceDay | null) => void;
}) {
  const [rows, setRows] = useState<Row[]>(() =>
    day.scans.map((entry) => ({
      scanId: entry.scan_id,
      role: entry.role === "extra" ? "Extra" : entry.role.toUpperCase(),
      original: local(entry.at),
      value: local(entry.at),
      removed: false,
    })),
  );
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const update = (i: number, patch: Partial<Row>) => setRows((all) => all.map((row, j) => (j === i ? { ...row, ...patch } : row)));

  // A moved scan is the old one voided plus the new time added.
  const voids = rows.filter((r) => r.scanId !== null && (r.removed || r.value !== r.original)).map((r) => r.scanId!);
  const adds = rows.filter((r) => !r.removed && r.value && (r.scanId === null || r.value !== r.original)).map((r) => r.value);
  const changed = voids.length + adds.length > 0;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!day.employee) return;
    setError(null);
    setSaving(true);

    try {
      const res = await api.attendance.adjust({ employee_id: day.employee.id, date: day.date, reason, add: adds, void: voids });
      notifySuccess("Attendance adjusted", "The day was recalculated.");
      onSaved(res.day);
    } catch (err) {
      notifyError(err);
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSave} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold">Adjust scans</h3>
        <p className="-mt-1 text-xs text-muted-foreground">
          Change a time, remove a wrong scan, or add a missing one. The schedule still decides whether each is an IN or an OUT. Removed and
          replaced scans stay on record with your reason.
        </p>

        {rows.map((row, i) => (
          <div key={row.scanId ?? `new-${i}`} className="flex items-center gap-2">
            <span className="w-12 shrink-0 text-xs font-medium text-muted-foreground">{row.role ?? "New"}</span>
            <Input
              type="datetime-local"
              required={!row.removed}
              disabled={row.removed}
              aria-label={`Scan ${i + 1}`}
              value={row.value}
              onChange={(e) => update(i, { value: e.target.value })}
              className={cn("w-56", row.removed && "line-through")}
            />
            {row.scanId !== null && row.value !== row.original && !row.removed && (
              <span className="text-xs text-warning">Changed</span>
            )}
            {row.scanId === null ? (
              <Button type="button" variant="ghost" size="icon-sm" aria-label="Remove this new scan" onClick={() => setRows((all) => all.filter((_, j) => j !== i))}>
                <Trash2 className="size-3.5" />
              </Button>
            ) : row.removed || row.value !== row.original ? (
              <Button type="button" variant="ghost" size="sm" onClick={() => update(i, { value: row.original, removed: false })}>
                <RotateCcw className="size-3.5" />
                Undo
              </Button>
            ) : (
              <Button type="button" variant="ghost" size="icon-sm" aria-label="Remove this scan" onClick={() => update(i, { removed: true })}>
                <Trash2 className="size-3.5" />
              </Button>
            )}
          </div>
        ))}

        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="self-start"
          onClick={() =>
            setRows((all) => {
              // Start from the next missing slot's expected time — usually the scan that was forgotten.
              const missing = day.slots.find((s) => s.status === "missing" && !all.some((r) => r.value === local(s.expected_at)));
              return [...all, { scanId: null, role: null, original: "", value: missing ? local(missing.expected_at) : `${day.date}T09:00`, removed: false }];
            })
          }
        >
          <Plus className="size-3.5" />
          Add a scan
        </Button>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="adjust-reason">Reason</Label>
        <Input
          id="adjust-reason"
          required
          maxLength={255}
          placeholder="e.g. Scanner was down; confirmed with the branch manager"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </div>

      {error && <Alert variant="destructive">{error}</Alert>}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving || !changed}>
          {saving ? "Saving…" : "Save adjustment"}
        </Button>
      </div>
    </form>
  );
}
