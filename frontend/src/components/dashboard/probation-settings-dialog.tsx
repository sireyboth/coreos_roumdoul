"use client";

import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMe } from "@/contexts/me-context";
import { api, ApiError, type ProbationSettings } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { notifySuccess } from "@/lib/notify";

const SELECT_CLASS = "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none";

/** The company's probation rules: default length (days or months) and when HR is reminded. */
export function ProbationSettingsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const t = useT();
  const { me, refresh } = useMe();
  const company = me?.company;
  const [length, setLength] = useState(String(company?.probation_length ?? 3));
  const [unit, setUnit] = useState<ProbationSettings["probation_unit"]>(company?.probation_unit ?? "months");
  const [reminder, setReminder] = useState(company?.probation_reminder_days == null ? "" : String(company.probation_reminder_days));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api.probation.updateSettings({
        probation_length: Number(length || 0),
        probation_unit: unit,
        probation_reminder_days: reminder.trim() === "" ? null : Number(reminder),
      });
      // The employee form reads the default from /me.
      await refresh();
      notifySuccess(t("employees.probation.saved"));
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("common.message.saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("employees.probation.settings")}</DialogTitle>
          <DialogDescription>{t("employees.probation.settingsDescription")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="probation-length">{t("employees.probation.length")}</Label>
            <div className="grid grid-cols-[1fr_8rem] gap-2">
              <Input
                id="probation-length"
                type="number"
                inputMode="numeric"
                min={0}
                max={unit === "days" ? 730 : 24}
                step={1}
                value={length}
                onChange={(e) => setLength(e.target.value)}
                required
              />
              <select aria-label={t("employees.probation.length")} value={unit} onChange={(e) => setUnit(e.target.value as ProbationSettings["probation_unit"])} className={SELECT_CLASS}>
                <option value="months">{t("employees.probation.unitMonths")}</option>
                <option value="days">{t("employees.probation.unitDays")}</option>
              </select>
            </div>
            <p className="text-xs text-muted-foreground">{t("employees.probation.lengthHint")}</p>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="probation-reminder">{t("employees.probation.reminder")}</Label>
            <Input id="probation-reminder" type="number" inputMode="numeric" min={1} max={90} step={1} value={reminder} onChange={(e) => setReminder(e.target.value)} />
            <p className="text-xs text-muted-foreground">{t("employees.probation.reminderHint")}</p>
          </div>
          <Alert variant="info">{t("employees.probation.lawNote")}</Alert>
          {error && <Alert variant="destructive">{error}</Alert>}
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>{t("common.action.cancel")}</DialogClose>
            <Button type="submit" disabled={saving}>
              {saving ? t("common.message.saving") : t("common.action.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
