"use client";

import { useState } from "react";
import { CalendarDays, ClipboardCheck, FileText, Plane, Wallet, CircleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ChoiceCards, FormField, FormSection, ToggleRow } from "@/components/dashboard/shared/form-section";
import { api, ApiError, type LeaveType, type LeaveTypeInput } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { notifySuccess } from "@/lib/notify";

/*
 * Create or edit a leave type, in four short sections: basics, pay & counting,
 * how many days, and the rules for asking. The form keeps every number as text
 * (so a field can be empty = "no rule") and converts on save.
 */

type Form = Record<keyof Omit<LeaveType, "id" | "requires_balance" | "allow_half_day" | "allowed_during_probation" | "is_active" | "report_code" | "color" | "text_color" | "bold">, string> & {
  requires_balance: boolean;
  allow_half_day: boolean;
  allowed_during_probation: boolean;
  is_active: boolean;
};

function toForm(t: LeaveType | null): Form {
  const s = (v: number | string | null | undefined) => (v === null || v === undefined ? "" : String(v));
  return {
    code: t?.code ?? "",
    name: t?.name ?? "",
    name_km: t?.name_km ?? "",
    pay_percent: s(t?.pay_percent ?? 100),
    counts: t?.counts ?? "work_days",
    accrual: t?.accrual ?? "none",
    yearly_days: s(t?.yearly_days),
    seniority_every_years: s(t?.seniority_every_years),
    seniority_extra_days: s(t?.seniority_extra_days),
    eligible_after_months: s(t?.eligible_after_months),
    attachment_from_days: s(t?.attachment_from_days),
    min_notice_days: s(t?.min_notice_days),
    max_days_per_request: s(t?.max_days_per_request),
    gender: t?.gender ?? "",
    sort_order: s(t?.sort_order),
    requires_balance: t?.requires_balance ?? false,
    allow_half_day: t?.allow_half_day ?? true,
    allowed_during_probation: t?.allowed_during_probation ?? true,
    is_active: t?.is_active ?? true,
  };
}

function toPayload(f: Form): LeaveTypeInput {
  const n = (v: string) => (v.trim() === "" ? null : Number(v));
  // Days a year set → a limit with a balance; empty or 0 → no limit.
  const limited = (n(f.yearly_days) ?? 0) > 0;
  return {
    name: f.name.trim(),
    name_km: f.name_km.trim() || null,
    pay_percent: Number(f.pay_percent || 0),
    counts: f.counts as LeaveType["counts"],
    accrual: limited ? (f.accrual === "none" ? "yearly" : (f.accrual as LeaveType["accrual"])) : "none",
    yearly_days: limited ? n(f.yearly_days) : null,
    seniority_every_years: n(f.seniority_every_years),
    seniority_extra_days: n(f.seniority_extra_days),
    eligible_after_months: n(f.eligible_after_months),
    attachment_from_days: n(f.attachment_from_days),
    min_notice_days: n(f.min_notice_days),
    max_days_per_request: n(f.max_days_per_request),
    gender: (f.gender || null) as LeaveType["gender"],
    sort_order: n(f.sort_order),
    requires_balance: limited,
    allow_half_day: f.allow_half_day,
    allowed_during_probation: f.allowed_during_probation,
    is_active: f.is_active,
  };
}

/** A number box that may be left empty (= no rule). */
function Num({ id, label, value, onChange, hint, step = "0.5" }: { id: string; label: string; value: string; onChange: (v: string) => void; hint?: string; step?: string }) {
  return (
    <FormField id={id} label={label} hint={hint}>
      <Input id={id} type="number" inputMode="decimal" min={0} step={step} value={value} onChange={(e) => onChange(e.target.value)} />
    </FormField>
  );
}

export function LeaveTypeDialog({ type, open, onOpenChange, onSaved }: { type: LeaveType | null; open: boolean; onOpenChange: (o: boolean) => void; onSaved: () => void }) {
  const t = useT();
  const [form, setForm] = useState<Form>(() => toForm(type));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const set = (patch: Partial<Form>) => setForm((f) => ({ ...f, ...patch }));
  // A number of days a year = a limit, kept as a balance; none = no limit.
  const limited = form.yearly_days.trim() !== "" && Number(form.yearly_days) > 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (type) await api.leave.updateType(type.id, toPayload(form));
      else await api.leave.createType({ ...toPayload(form), code: form.code.trim().toLowerCase() });
      notifySuccess(type ? t("leave.policyPage.typeSaved") : t("leave.policyPage.typeAdded"), form.name);
      onSaved();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("common.message.saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[min(92dvh,900px)] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
        <DialogHeader className="flex-row items-center gap-3 border-b border-border px-5 py-4 pr-12 text-left">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-purple-500 to-indigo-500 text-white shadow-sm">
            <Plane className="size-5" />
          </span>
          <div className="min-w-0">
            <DialogTitle className="text-lg">{type ? type.name : t("leave.policyPage.newType")}</DialogTitle>
            <DialogDescription>{t("leave.policyPage.typeDescription")}</DialogDescription>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto bg-muted/30 px-4 py-4 sm:px-6">
            <div className="flex flex-col gap-4">
              {/* 1. Basics. */}
              <FormSection icon={FileText} tone="from-sky-500 to-indigo-500" title={t("leave.policyPage.basicsTitle")} hint={t("leave.policyPage.basicsHint")}>
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField id="lt-name" label={t("common.field.name")}>
                    <Input id="lt-name" value={form.name} onChange={(e) => set({ name: e.target.value })} required />
                  </FormField>
                  <FormField id="lt-km" label={t("leave.policyPage.nameKm")}>
                    <Input id="lt-km" value={form.name_km} onChange={(e) => set({ name_km: e.target.value })} />
                  </FormField>
                  {!type && (
                    <FormField id="lt-code" label={t("leave.policyPage.code")} hint={t("leave.policyPage.codeHint")}>
                      <Input
                        id="lt-code"
                        value={form.code}
                        onChange={(e) => set({ code: e.target.value })}
                        placeholder={t("leave.policyPage.codePlaceholder")}
                        pattern="[a-z0-9_]+"
                        required
                      />
                    </FormField>
                  )}
                  <Num id="lt-order" label={t("leave.policyPage.order")} value={form.sort_order} onChange={(v) => set({ sort_order: v })} step="1" />
                </div>
                <ToggleRow id="lt-active" label={t("common.status.active")} hint={t("leave.policyPage.activeHint")} checked={form.is_active} onChange={(v) => set({ is_active: v })} />
              </FormSection>

              {/* 2. Pay and how days are counted. */}
              <FormSection icon={Wallet} tone="from-emerald-500 to-teal-500" title={t("leave.policyPage.payTitle")} hint={t("leave.policyPage.payTitleHint")}>
                <div className="grid gap-4 sm:grid-cols-[10rem_1fr]">
                  <Num id="lt-pay" label={t("leave.policyPage.pay")} value={form.pay_percent} onChange={(v) => set({ pay_percent: v })} step="1" hint={t("leave.policyPage.payHint")} />
                  <FormField label={t("leave.policyPage.counts")}>
                    <ChoiceCards
                      name="lt-counts"
                      value={form.counts}
                      // Calendar days can't be split into half days.
                      onChange={(v) => set({ counts: v, ...(v === "calendar_days" ? { allow_half_day: false } : {}) })}
                      options={[
                        { value: "work_days", label: t("leave.policyPage.workDays") },
                        { value: "calendar_days", label: t("leave.policyPage.calendarDays") },
                      ]}
                    />
                  </FormField>
                </div>
              </FormSection>

              {/* 3. How many days, and when they are earned. */}
              <FormSection icon={CalendarDays} tone="from-amber-500 to-orange-500" title={t("leave.policyPage.allowanceTitle")} hint={t("leave.policyPage.allowanceHint")}>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Num
                    id="lt-yearly"
                    label={t("leave.policyPage.yearly")}
                    value={form.yearly_days}
                    onChange={(v) => set({ yearly_days: v, ...(v.trim() !== "" && form.accrual === "none" ? { accrual: "yearly" } : {}) })}
                    hint={t("leave.policyPage.yearlyHint")}
                  />
                  <Num id="lt-eligible" label={t("leave.policyPage.eligible")} value={form.eligible_after_months} onChange={(v) => set({ eligible_after_months: v })} step="1" />
                </div>
                {limited && (
                  <>
                    <FormField label={t("leave.policyPage.accrual")}>
                      <ChoiceCards
                        name="lt-accrual"
                        value={form.accrual}
                        onChange={(v) => set({ accrual: v })}
                        options={[
                          { value: "yearly", label: t("leave.policyPage.accrualYearly") },
                          { value: "monthly", label: t("leave.policyPage.accrualMonthly") },
                        ]}
                      />
                    </FormField>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Num id="lt-sen-years" label={t("leave.policyPage.seniorityYears")} value={form.seniority_every_years} onChange={(v) => set({ seniority_every_years: v })} step="1" />
                      <Num id="lt-sen-days" label={t("leave.policyPage.seniorityDays")} value={form.seniority_extra_days} onChange={(v) => set({ seniority_extra_days: v })} />
                    </div>
                  </>
                )}
              </FormSection>

              {/* 4. Who can take it and how to ask. */}
              <FormSection icon={ClipboardCheck} tone="from-violet-500 to-fuchsia-500" title={t("leave.policyPage.askTitle")} hint={t("leave.policyPage.askHint")}>
                <FormField label={t("leave.policyPage.gender")}>
                  <ChoiceCards
                    name="lt-gender"
                    value={form.gender}
                    onChange={(v) => set({ gender: v })}
                    options={[
                      { value: "", label: t("leave.policyPage.everyone") },
                      { value: "female", label: t("leave.policyPage.women") },
                      { value: "male", label: t("leave.policyPage.men") },
                    ]}
                  />
                </FormField>
                <div className="grid gap-4 sm:grid-cols-3">
                  <Num id="lt-max" label={t("leave.policyPage.maxDays")} value={form.max_days_per_request} onChange={(v) => set({ max_days_per_request: v })} />
                  <Num id="lt-doc" label={t("leave.policyPage.documentFrom")} value={form.attachment_from_days} onChange={(v) => set({ attachment_from_days: v })} hint={t("leave.policyPage.documentHint")} />
                  <Num id="lt-notice" label={t("leave.policyPage.notice")} value={form.min_notice_days} onChange={(v) => set({ min_notice_days: v })} step="1" />
                </div>
                <ToggleRow
                  id="lt-half"
                  label={t("leave.policyPage.allowHalf")}
                  checked={form.allow_half_day}
                  disabled={form.counts === "calendar_days"}
                  onChange={(v) => set({ allow_half_day: v })}
                />
                <ToggleRow id="lt-probation" label={t("leave.policyPage.allowProbation")} checked={form.allowed_during_probation} onChange={(v) => set({ allowed_during_probation: v })} />
              </FormSection>
            </div>
          </div>

          {/* Footer: always in view. */}
          <div className="flex items-center justify-end gap-3 border-t border-border bg-popover px-5 py-3">
            {/* The error sits next to Save, so it's seen right where the click happened. */}
            {error && (
              <p role="alert" className="mr-auto flex min-w-0 items-start gap-1.5 text-sm text-destructive">
                <CircleAlert className="mt-0.5 size-4 shrink-0" />
                <span className="line-clamp-2">{error}</span>
              </p>
            )}
            <DialogClose render={<Button type="button" variant="outline" />}>{t("common.action.cancel")}</DialogClose>
            <Button type="submit" disabled={saving}>
              {saving ? t("common.message.saving") : t("common.action.save")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
