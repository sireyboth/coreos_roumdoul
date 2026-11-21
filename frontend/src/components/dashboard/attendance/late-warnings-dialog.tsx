"use client";

import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useMe } from "@/contexts/me-context";
import { api, ApiError } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { notifySuccess } from "@/lib/notify";
import { cn } from "@/lib/utils";

/**
 * The company's automatic late warning rule: on/off, after how many late
 * days a month, and whether leaving early counts. Read from /me's company;
 * the server's hourly attendance:late-warnings sends the alerts.
 * Mounted only while open, so it always starts from the saved values.
 */
export function LateWarningsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const t = useT();
  const { me, refresh } = useMe();
  const company = me?.company;
  const [enabled, setEnabled] = useState(company?.late_warning_limit != null);
  // Turning it on starts from 3, a common rule.
  const [limit, setLimit] = useState(String(company?.late_warning_limit ?? 3));
  const [countsEarly, setCountsEarly] = useState(company?.late_warning_counts_early ?? true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api.attendance.updateLateWarnings({
        late_warning_limit: enabled ? Number(limit) : null,
        late_warning_counts_early: countsEarly,
      });
      // The header button shows the rule from /me.
      await refresh();
      notifySuccess(t("attendance.lateWarnings.saved"));
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof ApiError ? (err.errors ? Object.values(err.errors)[0][0] : err.message) : t("common.message.saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("attendance.lateWarnings.title")}</DialogTitle>
          <DialogDescription>{t("attendance.lateWarnings.description")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="late-warnings-on">{t("attendance.lateWarnings.enabled")}</Label>
            <Switch id="late-warnings-on" checked={enabled} onCheckedChange={setEnabled} />
          </div>

          {/* Kept on screen while off (dimmed), so people see what turning it on means. */}
          <fieldset disabled={!enabled} className={cn("flex flex-col gap-4 transition-opacity", !enabled && "opacity-50")}>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="late-warnings-limit">{t("attendance.lateWarnings.limit")}</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="late-warnings-limit"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={31}
                  step={1}
                  required={enabled}
                  value={limit}
                  onChange={(e) => setLimit(e.target.value)}
                  className="w-24"
                />
                <span className="text-sm text-muted-foreground">{t("attendance.lateWarnings.limitUnit")}</span>
              </div>
              <p className="text-xs text-muted-foreground">{t("attendance.lateWarnings.limitHint")}</p>
            </div>

            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-col gap-0.5">
                <Label htmlFor="late-warnings-early">{t("attendance.lateWarnings.countsEarly")}</Label>
                <p className="text-xs text-muted-foreground">{t("attendance.lateWarnings.countsEarlyHint")}</p>
              </div>
              <Switch id="late-warnings-early" checked={countsEarly} onCheckedChange={setCountsEarly} />
            </div>
          </fieldset>

          <Alert variant="info">{t("attendance.lateWarnings.approvedNote")}</Alert>
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
