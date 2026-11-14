"use client";

import { useState } from "react";
import { CalendarDays, Clock, Coins, Lightbulb, Scale } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChoiceCards, FormField, FormSection, ToggleRow } from "@/components/dashboard/shared/form-section";
import { api, type PayrollPolicy } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { notifyError, notifySuccess } from "@/lib/notify";
import { cn } from "@/lib/utils";

/*
 * "How pay is worked out": the company-wide pay rules, split into four small
 * cards (rates, attendance, money, labor law) so each question is answered on
 * its own, with a live example under the rate settings.
 */

const SELECT_CLASS = "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

/** The salary the live example uses (the same one the payroll guide uses). */
const EXAMPLE_SALARY = 520;

/** Days the example divides by when the real number changes each month or person. */
const EXAMPLE_DAYS: Record<PayrollPolicy["rate_basis"], number | null> = { fixed: null, calendar: 30, scheduled: 26 };

const usd = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });

export function PolicyForm({ policy, onSaved, onEditOvertime }: { policy: PayrollPolicy; onSaved: (p: PayrollPolicy) => void; onEditOvertime?: () => void }) {
  const t = useT();
  const [form, setForm] = useState(policy);
  const [saving, setSaving] = useState(false);
  const set = (patch: Partial<PayrollPolicy>) => setForm((f) => ({ ...f, ...patch }));
  const changed = JSON.stringify(form) !== JSON.stringify(policy);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      onSaved(await api.payroll.updatePolicy({ ...form, fallback_exchange_rate: form.fallback_exchange_rate || null }));
      notifySuccess(t("payroll.settings.policy.saved"));
    } catch (err) {
      notifyError(err);
    } finally {
      setSaving(false);
    }
  }

  // Live example: $520 ÷ days = a day, ÷ hours = an hour.
  const days = EXAMPLE_DAYS[form.rate_basis] ?? form.rate_basis_days;
  const daily = days > 0 ? EXAMPLE_SALARY / days : 0;
  const hourly = form.hours_per_day > 0 ? daily / form.hours_per_day : 0;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">{t("payroll.settings.policy.description")}</p>

      {/* 1. Daily and hourly rate. */}
      <FormSection icon={CalendarDays} tone="from-sky-500 to-indigo-500" title={t("payroll.settings.policy.rateGroup")} hint={t("payroll.settings.policy.rateGroupHint")}>
        <FormField label={t("payroll.settings.policy.dailyRate")}>
          <ChoiceCards
            name="rate_basis"
            value={form.rate_basis}
            onChange={(v) => set({ rate_basis: v })}
            options={[
              { value: "fixed", label: t("payroll.settings.policy.basisFixed") },
              { value: "calendar", label: t("payroll.settings.policy.basisCalendar") },
              { value: "scheduled", label: t("payroll.settings.policy.basisScheduled") },
            ]}
          />
        </FormField>
        <div className="grid gap-4 sm:grid-cols-2">
          {form.rate_basis === "fixed" && (
            <FormField id="pol-days" label={t("payroll.settings.policy.days")} hint={t("payroll.settings.policy.daysHint")}>
              <Input id="pol-days" type="number" min={1} max={31} value={form.rate_basis_days} onChange={(e) => set({ rate_basis_days: Number(e.target.value) })} />
            </FormField>
          )}
          <FormField id="pol-hours" label={t("payroll.settings.policy.hours")} hint={t("payroll.settings.policy.hoursHint")}>
            <Input id="pol-hours" type="number" min={1} max={24} step="0.5" value={form.hours_per_day} onChange={(e) => set({ hours_per_day: Number(e.target.value) })} />
          </FormField>
        </div>
        <div className="flex gap-2.5 rounded-lg bg-amber-50 px-3 py-2.5 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
          <Lightbulb className="mt-0.5 size-4 shrink-0" />
          <p>
            {t("payroll.settings.policy.example", {
              salary: usd(EXAMPLE_SALARY),
              days,
              daily: usd(daily),
              hours: form.hours_per_day,
              hourly: usd(hourly),
            })}
            {EXAMPLE_DAYS[form.rate_basis] !== null && <> {t("payroll.settings.policy.exampleVaries")}</>}
          </p>
        </div>
      </FormSection>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* 2. Attendance. */}
        <FormSection icon={Clock} tone="from-rose-500 to-pink-500" title={t("payroll.settings.policy.attendanceGroup")} hint={t("payroll.settings.policy.attendanceGroupHint")}>
          <FormField label={t("payroll.settings.policy.missing")}>
            <ChoiceCards
              name="missing_scan_policy"
              stacked
              value={form.missing_scan_policy}
              onChange={(v) => set({ missing_scan_policy: v })}
              options={[
                { value: "review", label: t("payroll.settings.policy.missingReview") },
                { value: "present", label: t("payroll.settings.policy.missingPresent") },
                { value: "absent", label: t("payroll.settings.policy.missingAbsent") },
              ]}
            />
          </FormField>
          <ToggleRow
            id="pol-holidays"
            label={t("payroll.settings.policy.holidays")}
            hint={t("payroll.settings.policy.holidaysHint")}
            checked={form.daily_paid_holidays}
            onChange={(v) => set({ daily_paid_holidays: v })}
          />
        </FormSection>

        {/* 3. Money and rounding. */}
        <FormSection icon={Coins} tone="from-emerald-500 to-teal-500" title={t("payroll.settings.policy.moneyGroup")} hint={t("payroll.settings.policy.moneyGroupHint")}>
          <FormField id="pol-rate" label={t("payroll.settings.policy.rate")} hint={t("payroll.settings.policy.rateHint")}>
            <Input
              id="pol-rate"
              type="number"
              min={1000}
              max={10000}
              placeholder={t("payroll.settings.policy.ratePlaceholder")}
              value={form.fallback_exchange_rate ?? ""}
              onChange={(e) => set({ fallback_exchange_rate: e.target.value === "" ? null : Number(e.target.value) })}
            />
          </FormField>
          <FormField id="pol-round" label={t("payroll.settings.policy.rounding")}>
            <select id="pol-round" className={SELECT_CLASS} value={form.khr_rounding} onChange={(e) => set({ khr_rounding: Number(e.target.value) })}>
              <option value={1}>{t("payroll.settings.policy.roundExact")}</option>
              <option value={100}>{t("payroll.settings.policy.round100")}</option>
              <option value={500}>{t("payroll.settings.policy.round500")}</option>
              <option value={1000}>{t("payroll.settings.policy.round1000")}</option>
            </select>
          </FormField>
        </FormSection>
      </div>

      {/* 4. Labor law. */}
      <FormSection icon={Scale} tone="from-violet-500 to-fuchsia-500" title={t("payroll.settings.policy.lawGroup")} hint={t("payroll.settings.policy.lawGroupHint")}>
        <ToggleRow
          id="pol-overtime"
          label={t("payroll.settings.policy.overtimeMinimums")}
          hint={t("payroll.settings.policy.overtimeHint")}
          checked={form.enforce_overtime_minimums}
          onChange={(v) => set({ enforce_overtime_minimums: v })}
        />
        {!form.enforce_overtime_minimums && <Alert variant="warning">{t("payroll.settings.policy.overtimeWarning")}</Alert>}
        {/* How overtime is paid lives on the Overtime pay component; a way there from the switch people look at first. */}
        {onEditOvertime && (
          <p className="text-xs text-muted-foreground">
            {t("payroll.settings.policy.overtimeRuleText")}{" "}
            <button type="button" className="font-medium text-primary underline-offset-4 hover:underline" onClick={onEditOvertime}>
              {t("payroll.settings.policy.overtimeRuleLink")}
            </button>
          </p>
        )}
      </FormSection>

      {/* Save bar: stays in view at the bottom while there are unsaved changes. */}
      <div
        className={cn(
          "flex flex-wrap items-center justify-end gap-3 rounded-xl border border-border bg-card px-4 py-3",
          changed && "sticky bottom-4 z-10 shadow-lg",
        )}
      >
        {changed && <p className="mr-auto text-sm text-muted-foreground">{t("payroll.settings.policy.unsaved")}</p>}
        {changed && (
          <Button type="button" variant="ghost" onClick={() => setForm(policy)} disabled={saving}>
            {t("payroll.settings.policy.undo")}
          </Button>
        )}
        <Button type="submit" disabled={saving || !changed}>
          {saving ? t("common.message.saving") : t("payroll.settings.policy.save")}
        </Button>
      </div>
    </form>
  );
}

