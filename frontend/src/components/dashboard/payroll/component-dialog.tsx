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
import { notifySuccess } from "@/lib/notify";
import { PayslipView } from "./payslip-view";
import { KIND_HINTS, KIND_LABELS, previousMonth } from "./shared";

const SELECT_CLASS = "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none";

type Params = Record<string, unknown>;

const TEMPLATE_LABELS: Record<PayTemplate, string> = {
  overtime: "Overtime",
  attendance_bonus: "Attendance bonus",
  absence: "Absence",
  unpaid_leave: "Unpaid leave",
  late: "Late arrival",
  early_leave: "Early leave",
  unpaid_permission: "Unpaid permission",
};

const LATENESS_MODES: { value: LatenessMode; label: string; hint: string }[] = [
  { value: "per_minute", label: "Per minute", hint: "Each minute costs the minute rate (salary ÷ days ÷ hours ÷ 60)." },
  { value: "per_time", label: "Fixed amount each time", hint: "The same amount every time, with some free each month." },
  { value: "count_based", label: "Every few times = one day", hint: "e.g. every 3 times costs one day's pay." },
  { value: "tiers", label: "Tiers by minutes", hint: "Each day is charged by how late it was." },
  { value: "none", label: "Not charged", hint: "Recorded in attendance, never deducted." },
];

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
function TemplateFields({ template, params, onChange }: { template: PayTemplate; params: Params; onChange: (p: Params) => void }) {
  const set = (patch: Params) => onChange({ ...params, ...patch });

  if (template === "overtime") {
    const field = (key: string, label: string, min: number) => (
      <NumberField id={`ot-${key}`} label={label} suffix="%" min={min * 100} step="5" value={Math.round(Number(params[key]) * 100)} onChange={(n) => set({ [key]: n / 100 })} hint={`At least ${min * 100}% by law.`} />
    );
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {field("workday", "Work day", 1.5)}
        {field("day_off", "Day off", 2)}
        {field("holiday", "Public holiday", 2)}
      </div>
    );
  }

  if (template === "attendance_bonus") {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <NumberField id="ab-amount" label="Amount" step="0.01" value={params.amount} onChange={(n) => set({ amount: n })} hint="In each employee's salary currency." />
        <NumberField id="ab-absent" label="Max absences" value={params.max_absent_days} onChange={(n) => set({ max_absent_days: n })} />
        <NumberField id="ab-late" label="Max late arrivals" value={params.max_late_count} onChange={(n) => set({ max_late_count: n })} />
      </div>
    );
  }

  if (template === "absence") {
    return (
      <NumberField
        id="abs-mult"
        label="Charge per absent day"
        suffix="% of a day's pay"
        step="10"
        value={Math.round(Number(params.multiplier) * 100)}
        onChange={(n) => set({ multiplier: n / 100 })}
        hint="100% = one day's pay. Some companies charge 200% for an absence without notice."
      />
    );
  }

  if (template === "late" || template === "early_leave") {
    const p = params as unknown as LatenessParams;
    const mode = LATENESS_MODES.find((m) => m.value === p.mode) ?? LATENESS_MODES[0];
    const tiers = p.tiers ?? [];
    const setTier = (i: number, patch: Partial<LatenessParams["tiers"][number]>) => set({ tiers: tiers.map((t, j) => (j === i ? { ...t, ...patch } : t)) });

    return (
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="lt-mode">How it is charged</Label>
          <select id="lt-mode" className={SELECT_CLASS} value={p.mode} onChange={(e) => set({ mode: e.target.value })}>
            {LATENESS_MODES.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">{mode.hint}</p>
        </div>

        {p.mode === "per_minute" && (
          <NumberField id="lt-grace" label="Grace each day" suffix="minutes" value={p.grace_minutes} onChange={(n) => set({ grace_minutes: n })} hint="Minutes not charged each day, on top of the work schedule's own grace." />
        )}
        {p.mode === "per_time" && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <NumberField id="lt-amount" label="Amount each time" step="0.01" value={p.amount} onChange={(n) => set({ amount: n })} hint="In each employee's salary currency." />
            <NumberField id="lt-free" label="Free each month" value={p.free_count} onChange={(n) => set({ free_count: n })} />
          </div>
        )}
        {p.mode === "count_based" && (
          <NumberField id="lt-every" label="One day's pay every" suffix="times" min={1} value={p.every_n} onChange={(n) => set({ every_n: n })} />
        )}
        {p.mode === "tiers" && (
          <div className="flex flex-col gap-2">
            <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 text-xs text-muted-foreground">
              <span>Up to (minutes)</span>
              <span>Amount</span>
              <span>Share of a day</span>
              <span className="w-9" />
            </div>
            {tiers.map((t, i) => (
              <div key={i} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2">
                <Input type="number" min={1} placeholder="Longer" aria-label="Up to minutes" value={t.up_to_minutes ?? ""} onChange={(e) => setTier(i, { up_to_minutes: e.target.value === "" ? null : Number(e.target.value) })} />
                <Input type="number" min={0} step="0.01" aria-label="Amount" value={t.amount} onChange={(e) => setTier(i, { amount: Number(e.target.value) })} />
                <Input type="number" min={0} max={1} step="0.25" aria-label="Share of a day" value={t.day_fraction} onChange={(e) => setTier(i, { day_fraction: Number(e.target.value) })} />
                <Button type="button" variant="ghost" size="icon" aria-label="Remove tier" onClick={() => set({ tiers: tiers.filter((_, j) => j !== i) })}>
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" className="self-start" onClick={() => set({ tiers: [...tiers, { up_to_minutes: null, amount: 0, day_fraction: 0 }] })}>
              <Plus className="size-4" />
              Add tier
            </Button>
            <p className="text-xs text-muted-foreground">Leave “Up to” empty for the last tier (anything longer). Share of a day: 0.5 = half a day&apos;s pay.</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <p className="text-sm text-muted-foreground">
      {template === "unpaid_leave" && "Each unpaid leave day costs one day's pay. Leave types and how much they pay are set in Leave Policy."}
      {template === "unpaid_permission" && "Approved late-arrival or early-leave permission that isn't paid costs the minute rate for each minute."}
    </p>
  );
}

/** Tries the rule on a real employee's month before it is saved. */
function LivePreview({ component, params, isActive }: { component: PayComponent; params: Params; isActive: boolean }) {
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
      setError(err instanceof ApiError ? err.message : "Couldn't preview.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-dashed border-border p-3">
      <div>
        <p className="text-sm font-medium">Try it on an employee</p>
        <p className="text-xs text-muted-foreground">See their payslip with these settings, before saving. Nothing is changed.</p>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_10rem_auto]">
        <SearchableSelect options={people} value={employeeId} onChange={setEmployeeId} placeholder="Choose an employee" className="h-9 w-full rounded-md" />
        <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} aria-label="Month" />
        <Button type="button" variant="outline" onClick={run} disabled={!employeeId || !month || loading}>
          <Eye className="size-4" />
          {loading ? "Working…" : "Preview"}
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
export function ComponentDialog({ component, onOpenChange, onSaved }: { component: PayComponent | null; onOpenChange: (open: boolean) => void; onSaved: () => void }) {
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
      notifySuccess(isNew ? "Component added" : "Component saved", name.trim());
      onSaved();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{isNew ? "Add pay component" : name || component.name}</DialogTitle>
            <DialogDescription>
              {isNew
                ? "A line that can appear on payslips: an allowance, a deduction, or a rule worked out from attendance."
                : component.is_system
                  ? "A built-in component. Tune its rule or switch it off; it can't be deleted."
                  : "Your own component."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pc-name">Name on payslip</Label>
              <Input id="pc-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} placeholder="e.g. Transport allowance" required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pc-kind">Type</Label>
              <select id="pc-kind" className={SELECT_CLASS} value={kind} disabled={!isNew} onChange={(e) => setKind(e.target.value as PayKind)}>
                {(Object.keys(KIND_LABELS) as PayKind[]).map((k) => (
                  <option key={k} value={k}>
                    {KIND_LABELS[k]}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">{KIND_HINTS[kind]}</p>
            </div>
          </div>

          {isNew && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pc-method">Amount comes from</Label>
              <select
                id="pc-method"
                className={SELECT_CLASS}
                value={method === "template" ? `template:${template}` : method}
                onChange={(e) => {
                  const [m, t] = e.target.value.split(":");
                  setMethod(m as PayComponent["method"]);
                  setTemplate((t as PayTemplate) ?? null);
                  setParams(defaultParams((t as PayTemplate) ?? null));
                }}
              >
                <option value="employee_item">An amount set on each employee (allowance, loan…)</option>
                {(Object.keys(TEMPLATE_LABELS) as PayTemplate[]).map((t) => (
                  <option key={t} value={`template:${t}`}>
                    Attendance rule: {TEMPLATE_LABELS[t]}
                  </option>
                ))}
              </select>
            </div>
          )}

          {method === "template" && template && (
            <div className="flex flex-col gap-2 rounded-lg bg-muted/40 p-3">
              <p className="text-sm font-medium">Rule · {TEMPLATE_LABELS[template]}</p>
              <TemplateFields template={template} params={params} onChange={setParams} />
            </div>
          )}

          {!isBase && (
            <div className="flex flex-col gap-2">
              {kind === "earning" && (
                <>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={taxable} onChange={(e) => setTaxable(e.target.checked)} />
                    Subject to tax on salary
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={nssf} onChange={(e) => setNssf(e.target.checked)} />
                    Counts toward NSSF
                  </label>
                </>
              )}
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
                Active — used in pay runs
              </label>
            </div>
          )}

          {!isNew && method === "template" && <LivePreview component={component} params={params} isActive={isActive} />}

          {error && <Alert variant="destructive">{error}</Alert>}
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
            <Button type="submit" disabled={saving || !name.trim() || (method === "template" && !template)}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
