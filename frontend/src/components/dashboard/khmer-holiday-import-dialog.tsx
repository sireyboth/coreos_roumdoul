"use client";

import { useMemo, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { khmerHolidaysForYear } from "@/lib/khmer";
import { notifyError, notifySuccess } from "@/lib/notify";

type NameStyle = "en" | "km" | "both";

const SELECT_CLASS = "h-9 rounded-md border border-input bg-transparent px-3 text-sm outline-none";

export function KhmerHolidayImportDialog({
  open,
  onOpenChange,
  existingDates,
  onImported,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // "YYYY-MM-DD" of every holiday the company already has.
  existingDates: Set<string>;
  onImported: () => void;
}) {
  const thisYear = new Date().getFullYear();
  const [year, setYear] = useState(thisYear);
  const [nameStyle, setNameStyle] = useState<NameStyle>("en");
  // Dates the admin un-ticked; everything not already added starts ticked.
  const [unchecked, setUncheckedDates] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const holidays = useMemo(() => khmerHolidaysForYear(year), [year]);
  const selectable = holidays.filter((h) => !existingDates.has(h.date));
  const chosen = selectable.filter((h) => !unchecked.has(h.date));

  function toggle(date: string) {
    setUncheckedDates((current) => {
      const next = new Set(current);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  }

  function nameFor(h: (typeof holidays)[number]): string {
    if (nameStyle === "km") return h.nameKm;
    if (nameStyle === "both") return `${h.label} · ${h.nameKm}`;
    return h.label;
  }

  async function handleImport() {
    setSaving(true);

    try {
      const result = await api.holidays.import(chosen.map((h) => ({ name: nameFor(h), date: h.date })));
      notifySuccess(
        `${result.created} holiday${result.created === 1 ? "" : "s"} imported`,
        result.skipped.length > 0 ? `${result.skipped.length} already existed and were left alone.` : undefined,
      );
      onOpenChange(false);
      onImported();
    } catch (err) {
      notifyError(err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import Cambodian holidays</DialogTitle>
          <DialogDescription>
            Public and religious holidays worked out from the Khmer lunar calendar. Imported holidays are normal
            holidays — you can edit or delete them afterwards.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="import-year">Year</Label>
            <select
              id="import-year"
              value={year}
              onChange={(e) => {
                setYear(Number(e.target.value));
                setUncheckedDates(new Set());
              }}
              className={SELECT_CLASS}
            >
              {[thisYear - 1, thisYear, thisYear + 1, thisYear + 2].map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="import-names">Names in</Label>
            <select
              id="import-names"
              value={nameStyle}
              onChange={(e) => setNameStyle(e.target.value as NameStyle)}
              className={SELECT_CLASS}
            >
              <option value="en">English</option>
              <option value="km">ខ្មែរ</option>
              <option value="both">Both</option>
            </select>
          </div>
        </div>

        <Alert variant="info">
          The government often adds a day off when a holiday falls on a Sunday, and announces it each year. Those
          substitute days aren&apos;t included — add them yourself after importing.
        </Alert>

        <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
          {holidays.map((holiday) => {
            const already = existingDates.has(holiday.date);
            const date = new Date(holiday.date + "T00:00:00");
            const isSunday = date.getDay() === 0;

            return (
              <li key={holiday.date}>
                <label
                  className={`flex items-center gap-3 px-3 py-2.5 text-sm ${already ? "opacity-60" : "cursor-pointer hover:bg-muted/50"}`}
                >
                  <input
                    type="checkbox"
                    disabled={already}
                    checked={!already && !unchecked.has(holiday.date)}
                    onChange={() => toggle(holiday.date)}
                    className="size-4 rounded border-input"
                  />
                  <span className="w-28 shrink-0 text-muted-foreground">
                    {date.toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" })}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{holiday.label}</span>
                    <span className="block truncate text-xs text-muted-foreground">{holiday.nameKm}</span>
                  </span>
                  {isSunday && <Badge variant="warning">Sunday</Badge>}
                  {already && <Badge variant="secondary">Already added</Badge>}
                </label>
              </li>
            );
          })}
        </ul>

        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
          <Button onClick={handleImport} disabled={saving || chosen.length === 0}>
            {saving ? "Importing…" : `Import ${chosen.length} holiday${chosen.length === 1 ? "" : "s"}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
