"use client";

import { useEffect, useState } from "react";
import { Eye, Plus, Trash2 } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { api, ApiError, type LatenessMode, type LatenessParams, type PayComponent, type PayKind, type PayslipBody, type PayTemplate } from "@/lib/api";
import { translateNow, useT, type TKey } from "@/lib/i18n";
import { notifySuccess } from "@/lib/notify";
import { PayslipView } from "./payslip-view";
import { KIND_LABELS, previousMonth } from "./shared";

const SELECT_CLASS = "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none";

type Params = Record<string, unknown>;

const TEMPLATES: PayTemplate[] = ["overtime", "attendance_bonus", "absence", "unpaid_leave", "late", "early_leave", "unpaid_permission"];

const templateLabel = (template: PayTemplate): TKey => `payrollSetup.componentDialog.template.${template}`;

const LATENESS_MODES: LatenessMode[] = ["per_minute", "per_time", "count_based", "tiers", "none"];

function defaultParams(template: PayTemplate | null): Params {
  switch (template) {
    case "overtime":
      return { workday: 1.5, day_off: 2, holiday: 2 };
    case "attendance_bonus":
      return { amount: 0, max_absent_days: 0, max_late_count: 0 };
    case "absence":
      return { multiplier: 1 };
    case "late":
    case "early_leave":
      return { mode: "per_minute", grace_minutes: 0, amount: 0, free_count: 0, every_n: 3, tiers: [] };
    default:
      return {};
  }
}

function NumberField({ id, label, value, onChange, hint, step = "1", min = 0, suffix }: { id: string; label: string; value: unknown; onChange: (n: number) => void; hint?: string; step?: string; min?: number; suffix?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-2">
        <Input id={id} type="number" inputMode="decimal" min={min} step={step} value={String(value ?? "")} onChange={(e) => onChange(Number(e.target.value))} />
        {suffix && <span className="shrink-0 text-sm text-muted-foreground">{suffix}</span>}
      </div>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

/** The fields for one template's parameters. */
export function TemplateFields({
  template,
  params,
  onChange,
  enforceOvertimeMinimums = true,
}: {
  template: PayTemplate;
  params: Params;
  onChange: (p: Params) => void;
  /** The company's "Hold overtime to the Labor Law minimums" setting. */
  enforceOvertimeMinimums?: boolean;
}) {
  const t = useT();
  const set = (patch: Params) => onChange({ ...params, ...patch });

  if (template === "overtime") {
    const field = (key: string, label: string, legal: number) => {
      const belowLaw = Number(params[key]) < legal;
      const pct = legal * 100;
      const hint = enforceOvertimeMinimums
        ? t("payrollSetup.componentDialog.fields.lawAtLeast", { pct })
        : belowLaw
          ? t("payrollSetup.componentDialog.fields.lawBelow", { pct })
          : t("payrollSetup.componentDialog.fields.lawMinimum", { pct });
      return (
        <NumberField id={`ot-${key}`} label={label} suffix="%" min={enforceOvertimeMinimums ? legal * 100 : 0} step="5" value={Math.round(Number(params[key]) * 100)} onChange={(n) => set({ [key]: n / 100 })} hint={hint} />
      );
    };
    return (
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {field("workday", t("payrollSetup.componentDialog.fields.workday"), 1.5)}
          {field("day_off", t("payrollSetup.componentDialog.fields.dayOff"), 2)}
          {field("holiday", t("payrollSetup.componentDialog.fields.holiday"), 2)}
        </div>
        {!enforceOvertimeMinimums && <p className="text-xs text-muted-foreground">{t("payrollSetup.componentDialog.fields.lawOff")}</p>}
      </div>
    );
  }

  if (template === "attendance_bonus") {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <NumberField
          id="ab-amount"
          label={t("payrollSetup.componentDialog.fields.amount")}
          step="0.01"
          value={params.amount}
          onChange={(n) => set({ amount: n })}
          hint={t("payrollSetup.componentDialog.fields.inSalaryCurrency")}
        />
        <NumberField id="ab-absent" label={t("payrollSetup.componentDialog.fields.maxAbsences")} value={params.max_absent_days} onChange={(n) => set({ max_absent_days: n })} />
        <NumberField id="ab-late" label={t("payrollSetup.componentDialog.fields.maxLate")} value={params.max_late_count} onChange={(n) => set({ max_late_count: n })} />
      </div>
    );
  }

  if (template === "absence") {
    return (
      <NumberField
        id="abs-mult"
        label={t("payrollSetup.componentDialog.fields.chargePerAbsentDay")}
        suffix={t("payrollSetup.componentDialog.fields.pctOfDay")}
        step="10"
        value={Math.round(Number(params.multiplier) * 100)}
        onChange={(n) => set({ multiplier: n / 100 })}
        hint={t("payrollSetup.componentDialog.fields.absenceHint")}
      />
    );
  }

  if (template === "late" || template === "early_leave") {
    const p = params as unknown as LatenessParams;
    const mode = LATENESS_MODES.find((m) => m === p.mode) ?? LATENESS_MODES[0];
    const tiers = p.tiers ?? [];
    const setTier = (i: number, patch: Partial<LatenessParams["tiers"][number]>) => set({ tiers: tiers.map((tier, j) => (j === i ? { ...tier, ...patch } : tier)) });

    return (
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="lt-mode">{t("payrollSetup.componentDialog.fields.howCharged")}</Label>
          <select id="lt-mode" className={SELECT_CLASS} value={p.mode} onChange={(e) => set({ mode: e.target.value })}>
            {LATENESS_MODES.map((m) => (
              <option key={m} value={m}>
                {t(`payrollSetup.componentDialog.mode.${m}`)}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">{t(`payrollSetup.componentDialog.modeHint.${mode}`)}</p>
        </div>

        {p.mode === "per_minute" && (
          <NumberField
            id="lt-grace"
            label={t("payrollSetup.componentDialog.fields.graceEachDay")}
            suffix={t("payrollSetup.componentDialog.fields.minutes")}
            value={p.grace_minutes}
            onChange={(n) => set({ grace_minutes: n })}
            hint={t("payrollSetup.componentDialog.fields.graceHint")}
          />
        )}
        {p.mode === "per_time" && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <NumberField
              id="lt-amount"
              label={t("payrollSetup.componentDialog.fields.amountEachTime")}
              step="0.01"
              value={p.amount}
              onChange={(n) => set({ amount: n })}
              hint={t("payrollSetup.componentDialog.fields.inSalaryCurrency")}
            />
            <NumberField id="lt-free" label={t("payrollSetup.componentDialog.fields.freeEachPeriod")} value={p.free_count} onChange={(n) => set({ free_count: n })} />
          </div>
        )}
        {p.mode === "count_based" && (
          <NumberField
            id="lt-every"
            label={t("payrollSetup.componentDialog.fields.oneDayEvery")}
            suffix={t("payrollSetup.componentDialog.fields.times")}
            min={1}
            value={p.every_n}
            onChange={(n) => set({ every_n: n })}
          />
        )}
        {p.mode === "tiers" && (
          <div className="flex flex-col gap-2">
            <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 text-xs text-muted-foreground">
              <span>{t("payrollSetup.componentDialog.fields.upToMinutes")}</span>
              <span>{t("payrollSetup.componentDialog.fields.amount")}</span>
              <span>{t("payrollSetup.componentDialog.fields.shareOfDay")}</span>
              <span className="w-9" />
            </div>
            {tiers.map((tier, i) => (
              <div key={i} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2">
                <Input
                  type="number"
                  min={1}
                  placeholder={t("payrollSetup.componentDialog.fields.longer")}
                  aria-label={t("payrollSetup.componentDialog.fields.upToMinutesAria")}
                  value={tier.up_to_minutes ?? ""}
                  onChange={(e) => setTier(i, { up_to_minutes: e.target.value === "" ? null : Number(e.target.value) })}
                />
                <Input type="number" min={0} step="0.01" aria-label={t("payrollSetup.componentDialog.fields.amount")} value={tier.amount} onChange={(e) => setTier(i, { amount: Number(e.target.value) })} />
                <Input
                  type="number"
                  min={0}
                  max={1}
                  step="0.25"
                  aria-label={t("payrollSetup.componentDialog.fields.shareOfDay")}
                  value={tier.day_fraction}
                  onChange={(e) => setTier(i, { day_fraction: Number(e.target.value) })}
                />
                <Button type="button" variant="ghost" size="icon" aria-label={t("payrollSetup.componentDialog.fields.removeTier")} onClick={() => set({ tiers: tiers.filter((_, j) => j !== i) })}>
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" className="self-start" onClick={() => set({ tiers: [...tiers, { up_to_minutes: null, amount: 0, day_fraction: 0 }] })}>
              <Plus className="size-4" />
              {t("payrollSetup.componentDialog.fields.addTier")}
            </Button>
            <p className="text-xs text-muted-foreground">{t("payrollSetup.componentDialog.fields.tiersHint")}</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <p className="text-sm text-muted-foreground">
      {template === "unpaid_leave" && t("payrollSetup.componentDialog.fields.unpaidLeaveText")}
      {template === "unpaid_permission" && t("payrollSetup.componentDialog.fields.unpaidPermissionText")}
    </p>
  );
}

/** Tries the rule on a real employee's month before it is saved. */
function LivePreview({ component, params, isActive }: { component: PayComponent; params: Params; isActive: boolean }) {
  const t = useT();
  const [people, setPeople] = useState<{ value: string; label: string }[]>([]);
  const [employeeId, setEmployeeId] = useState("");
  const [month, setMonth] = useState(previousMonth);
  const [result, setResult] = useState<PayslipBody | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.employees.all().then((list) => setPeople(list.map((e) => ({ value: String(e.id), label: e.name })))).catch(() => setPeople([]));
  }, []);

  async function run() {
    setLoading(true);
    setError(null);
    try {
      setResult(await api.payroll.preview({ employee_id: Number(employeeId), month, component_id: component.id, params, is_active: isActive }));
    } catch (err) {
      setResult(null);
      setError(err instanceof ApiError ? err.message : translateNow("payrollSetup.componentDialog.preview.failed"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-dashed border-border p-3">
      <div>
        <p className="text-sm font-medium">{t("payrollSetup.componentDialog.preview.title")}</p>
        <p className="text-xs text-muted-foreground">{t("payrollSetup.componentDialog.preview.hint")}</p>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_10rem_auto]">
        <SearchableSelect options={people} value={employeeId} onChange={setEmployeeId} placeholder={t("payrollSetup.componentDialog.preview.chooseEmployee")} className="h-9 w-full rounded-md" />
        <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} aria-label={t("payrollSetup.componentDialog.preview.month")} />
        <Button type="button" variant="outline" onClick={run} disabled={!employeeId || !month || loading}>
          <Eye className="size-4" />
          {loading ? t("payrollSetup.componentDialog.preview.working") : t("payrollSetup.componentDialog.preview.preview")}
        </Button>
      </div>
      {error && <Alert variant="destructive">{error}</Alert>}
      {result && <PayslipView slip={result} highlight={component.code} />}
    </div>
  );
}

/**
 * Adds or edits a pay component. Built-in ones keep their kind and rule type;
 * the salary itself (BASE) can only be renamed.
 */
export function ComponentDialog({
  component,
  enforceOvertimeMinimums = true,
  onOpenChange,
  onSaved,
}: {
  component: PayComponent | null;
  enforceOvertimeMinimums?: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const t = useT();
  const isNew = component === null;
  const [name, setName] = useState(component?.name ?? "");
  const [kind, setKind] = useState<PayKind>(component?.kind ?? "earning");
  const [method, setMethod] = useState<PayComponent["method"]>(component?.method ?? "employee_item");
  const [template, setTemplate] = useState<PayTemplate | null>(component?.template ?? null);
  const [params, setParams] = useState<Params>(() => ({ ...defaultParams(component?.template ?? null), ...(component?.params ?? {}) }));
  const [taxable, setTaxable] = useState(component?.taxable ?? true);
  const [nssf, setNssf] = useState(component?.nssf_insurable ?? true);
  const [isActive, setIsActive] = useState(component?.is_active ?? true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const isBase = method === "base";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (isNew) {
        await api.payroll.createComponent({ name: name.trim(), kind, method, template: method === "template" ? template : null, params: method === "template" ? params : null, taxable, nssf_insurable: nssf, is_active: isActive });
      } else {
        await api.payroll.updateComponent(component.id, {
          name: name.trim(),
          ...(isBase ? {} : { is_active: isActive, taxable, nssf_insurable: nssf }),
          ...(method === "template" ? { params } : {}),
        });
      }
      notifySuccess(translateNow(isNew ? "payrollSetup.componentDialog.dialog.added" : "payrollSetup.componentDialog.dialog.saved"), name.trim());
      onSaved();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : translateNow("payrollSetup.componentDialog.dialog.saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{isNew ? t("payrollSetup.componentDialog.dialog.addTitle") : name || component.name}</DialogTitle>
            <DialogDescription>
              {isNew
                ? t("payrollSetup.componentDialog.dialog.newText")
                : component.is_system
                  ? t("payrollSetup.componentDialog.dialog.systemText")
                  : t("payrollSetup.componentDialog.dialog.ownText")}
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pc-name">{t("payrollSetup.componentDialog.dialog.nameOnPayslip")}</Label>
              <Input id="pc-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} placeholder={t("payrollSetup.componentDialog.dialog.namePlaceholder")} required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pc-kind">{t("payrollSetup.componentDialog.dialog.type")}</Label>
              <select id="pc-kind" className={SELECT_CLASS} value={kind} disabled={!isNew} onChange={(e) => setKind(e.target.value as PayKind)}>
                {(Object.keys(KIND_LABELS) as PayKind[]).map((k) => (
                  <option key={k} value={k}>
                    {t(`payroll.shared.kind.${k}`)}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">{t(`payroll.shared.kindHint.${kind}`)}</p>
            </div>
          </div>

          {isNew && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pc-method">{t("payrollSetup.componentDialog.dialog.amountFrom")}</Label>
              <select
                id="pc-method"
                className={SELECT_CLASS}
                value={method === "template" ? `template:${template}` : method}
                onChange={(e) => {
                  const [m, tpl] = e.target.value.split(":");
                  setMethod(m as PayComponent["method"]);
                  setTemplate((tpl as PayTemplate) ?? null);
                  setParams(defaultParams((tpl as PayTemplate) ?? null));
                }}
              >
                <option value="employee_item">{t("payrollSetup.componentDialog.dialog.employeeItem")}</option>
                {TEMPLATES.map((tpl) => (
                  <option key={tpl} value={`template:${tpl}`}>
                    {t("payrollSetup.componentDialog.dialog.attendanceRule", { name: t(templateLabel(tpl)) })}
                  </option>
                ))}
              </select>
            </div>
          )}

          {method === "template" && template && (
            <div className="flex flex-col gap-2 rounded-lg bg-muted/40 p-3">
              <p className="text-sm font-medium">{t("payrollSetup.componentDialog.dialog.rule", { name: t(templateLabel(template)) })}</p>
              <TemplateFields template={template} params={params} onChange={setParams} enforceOvertimeMinimums={enforceOvertimeMinimums} />
            </div>
          )}

          {!isBase && (
            <div className="flex flex-col gap-2">
              {kind === "earning" && (
                <>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={taxable} onChange={(e) => setTaxable(e.target.checked)} />
                    {t("payrollSetup.componentDialog.dialog.taxable")}
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={nssf} onChange={(e) => setNssf(e.target.checked)} />
                    {t("payrollSetup.componentDialog.dialog.nssf")}
                  </label>
                </>
              )}
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
                {t("payrollSetup.componentDialog.dialog.active")}
              </label>
            </div>
          )}

          {!isNew && method === "template" && <LivePreview component={component} params={params} isActive={isActive} />}

          {error && <Alert variant="destructive">{error}</Alert>}
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>{t("common.action.cancel")}</DialogClose>
            <Button type="submit" disabled={saving || !name.trim() || (method === "template" && !template)}>
              {saving ? t("payrollSetup.componentDialog.dialog.saving") : t("common.action.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
