"use client";

import { useState } from "react";
import { BadgeCheck, CalendarPlus, Hourglass } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, type Employee } from "@/lib/api";
import { dateOnly } from "@/lib/date";
import { dateLocale, useLang, useT, type Lang } from "@/lib/i18n";
import { notifyError, notifySuccess } from "@/lib/notify";
import { daysUntil, probationProgress } from "@/lib/probation";
import { cn } from "@/lib/utils";

export function probationDateLabel(value: string, lang: Lang): string {
  return new Date(dateOnly(value) + "T00:00:00").toLocaleDateString(dateLocale(lang), { year: "numeric", month: "short", day: "numeric" });
}

/** "12 days left" / "Last day is today" / "Ended 3 days ago…", with how urgent it is. */
export function useProbationCountdown() {
  const t = useT();
  return (endDate: string): { text: string; tone: "info" | "warning" | "destructive" } => {
    const days = daysUntil(endDate);
    if (days < 0) return { text: t("employees.probation.overdue", { n: -days }), tone: "destructive" };
    if (days === 0) return { text: t("employees.probation.lastDayToday"), tone: "warning" };
    return { text: days === 1 ? t("employees.probation.oneDayLeft") : t("employees.probation.daysLeft", { n: days }), tone: days <= 7 ? "warning" : "info" };
  };
}

/**
 * Someone's probation on their profile: when it started and ends, how far
 * through they are, and — for HR — passing them or giving more time.
 */
export function ProbationCard({ employee, canManage, onChanged }: { employee: Employee; canManage: boolean; onChanged: (employee: Employee) => void }) {
  const t = useT();
  const lang = useLang();
  const confirm = useConfirm();
  const countdown = useProbationCountdown();
  const [busy, setBusy] = useState(false);
  const [extending, setExtending] = useState(false);
  const [newEnd, setNewEnd] = useState("");

  const end = employee.probation_end_date ?? null;
  const progress = end ? probationProgress(employee.hire_date, end) : null;
  const status = end ? countdown(end) : null;

  async function pass() {
    const ok = await confirm({
      title: t("employees.probation.passTitle", { name: employee.name }),
      description: t("employees.probation.passBody", { name: employee.name }),
      confirmLabel: t("employees.probation.pass"),
    });
    if (!ok) return;
    setBusy(true);
    try {
      onChanged(await api.employees.passProbation(employee.id));
      notifySuccess(t("employees.probation.passedToast", { name: employee.name }));
    } catch (err) {
      notifyError(err);
    } finally {
      setBusy(false);
    }
  }

  async function extend(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      onChanged(await api.employees.extendProbation(employee.id, newEnd));
      notifySuccess(t("employees.probation.extendedToast", { date: probationDateLabel(newEnd, lang) }));
      setExtending(false);
    } catch (err) {
      notifyError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Hourglass className="size-4 text-info" /> {t("employees.probation.title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div className="flex flex-col gap-0.5">
            <dt className="text-xs text-muted-foreground">{t("employees.probation.started")}</dt>
            <dd className="font-medium tabular-nums">{employee.hire_date ? probationDateLabel(employee.hire_date, lang) : "—"}</dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="text-xs text-muted-foreground">{t("employees.probation.ends")}</dt>
            <dd className="font-medium tabular-nums">{end ? probationDateLabel(end, lang) : t("employees.probation.noEndDate")}</dd>
          </div>
        </dl>

        {progress !== null && (
          <div
            className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress * 100)}
          >
            <div
              className={cn("h-full rounded-full transition-all", status?.tone === "destructive" ? "bg-destructive" : status?.tone === "warning" ? "bg-warning" : "bg-info")}
              style={{ width: `${Math.max(progress * 100, 3)}%` }}
            />
          </div>
        )}

        {status && (
          <Badge variant={status.tone} className="h-auto self-start whitespace-normal py-1 text-left">
            {status.text}
          </Badge>
        )}

        {canManage && (
          <div className="flex flex-wrap gap-2">
            <Button onClick={pass} disabled={busy}>
              <BadgeCheck className="size-4" />
              {t("employees.probation.pass")}
            </Button>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => {
                setNewEnd("");
                setExtending(true);
              }}
            >
              <CalendarPlus className="size-4" />
              {t("employees.probation.extend")}
            </Button>
          </div>
        )}
      </CardContent>

      <Dialog open={extending} onOpenChange={setExtending}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("employees.probation.extendTitle")}</DialogTitle>
            <DialogDescription>{t("employees.probation.extendBody")}</DialogDescription>
          </DialogHeader>
          <form onSubmit={extend} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="probation-extend">{t("employees.probation.newEnd")}</Label>
              <Input id="probation-extend" type="date" min={end ? dateOnly(end) : undefined} value={newEnd} onChange={(e) => setNewEnd(e.target.value)} required />
            </div>
            <DialogFooter>
              <DialogClose render={<Button type="button" variant="outline" />}>{t("common.action.cancel")}</DialogClose>
              <Button type="submit" disabled={busy || !newEnd}>
                {busy ? t("common.message.saving") : t("common.action.save")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
