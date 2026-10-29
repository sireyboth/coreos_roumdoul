"use client";

import { useEffect, useState } from "react";
import { AlarmClock, Plus, Scale } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { PageHeader } from "@/components/dashboard/layout/page-header";
import { api, ApiError, type LateEarlySettings, type LeaveAdjustment, type LeaveBalances, type LeaveType, type LeaveTypeInput } from "@/lib/api";
import { dateLocale, translate, useLang, useT, type Lang } from "@/lib/i18n";
import { notifyError, notifySuccess } from "@/lib/notify";

const SELECT_CLASS = "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none";

/** A type's rules in one line: "18 days a year, earned monthly · after 12 months · half days". */
function rules(lt: LeaveType, lang: Lang): string {
  const tr = (key: Parameters<typeof translate>[1], vars?: Record<string, string | number>) => translate(lang, key, vars);
  return [
    lt.requires_balance && lt.yearly_days
      ? tr(lt.accrual === "monthly" ? "leave.policyPage.rules.yearlyMonthly" : "leave.policyPage.rules.yearlyJanuary", { n: lt.yearly_days })
      : tr("leave.policyPage.rules.noLimit"),
    lt.seniority_every_years && lt.seniority_extra_days
      ? tr("leave.policyPage.rules.seniority", { days: lt.seniority_extra_days, years: lt.seniority_every_years })
      : null,
    lt.eligible_after_months ? tr("leave.policyPage.rules.after", { n: lt.eligible_after_months }) : null,
    lt.allowed_during_probation ? null : tr("leave.policyPage.rules.notDuringProbation"),
    lt.counts === "calendar_days" ? tr("leave.policyPage.rules.calendarDays") : null,
    lt.max_days_per_request ? tr("leave.policyPage.rules.maxPerRequest", { n: lt.max_days_per_request }) : null,
    lt.attachment_from_days
      ? lt.attachment_from_days <= 1
        ? tr("leave.policyPage.rules.documentAlways")
        : tr("leave.policyPage.rules.documentFrom", { n: lt.attachment_from_days })
      : null,
    lt.min_notice_days ? tr("leave.policyPage.rules.notice", { n: lt.min_notice_days }) : null,
    lt.allow_half_day ? tr("leave.policyPage.rules.halfDays") : null,
    lt.gender ? tr(lt.gender === "female" ? "leave.policyPage.rules.women" : "leave.policyPage.rules.men") : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

type Form = Record<keyof Omit<LeaveType, "id" | "requires_balance" | "allow_half_day" | "allowed_during_probation" | "is_active">, string> & {
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

function Num({ id, label, value, onChange, hint, step = "0.5" }: { id: string; label: string; value: string; onChange: (v: string) => void; hint?: string; step?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type="number" inputMode="decimal" min={0} step={step} value={value} onChange={(e) => onChange(e.target.value)} />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function TypeDialog({ type, open, onOpenChange, onSaved }: { type: LeaveType | null; open: boolean; onOpenChange: (o: boolean) => void; onSaved: () => void }) {
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
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{type ? type.name : t("leave.policyPage.newType")}</DialogTitle>
          <DialogDescription>{t("leave.policyPage.typeDescription")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {!type && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="lt-code">{t("leave.policyPage.code")}</Label>
              <Input
                id="lt-code"
                value={form.code}
                onChange={(e) => set({ code: e.target.value })}
                placeholder={t("leave.policyPage.codePlaceholder")}
                pattern="[a-z0-9_]+"
                required
              />
              <p className="text-xs text-muted-foreground">{t("leave.policyPage.codeHint")}</p>
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="lt-name">{t("common.field.name")}</Label>
            <Input id="lt-name" value={form.name} onChange={(e) => set({ name: e.target.value })} required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="lt-km">{t("leave.policyPage.nameKm")}</Label>
            <Input id="lt-km" value={form.name_km} onChange={(e) => set({ name_km: e.target.value })} />
          </div>
          <Num
            id="lt-pay"
            label={t("leave.policyPage.pay")}
            value={form.pay_percent}
            onChange={(v) => set({ pay_percent: v })}
            step="1"
            hint={t("leave.policyPage.payHint")}
          />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="lt-counts">{t("leave.policyPage.counts")}</Label>
            <select id="lt-counts" value={form.counts} onChange={(e) => set({ counts: e.target.value, ...(e.target.value === "calendar_days" ? { allow_half_day: false } : {}) })} className={SELECT_CLASS}>
              <option value="work_days">{t("leave.policyPage.workDays")}</option>
              <option value="calendar_days">{t("leave.policyPage.calendarDays")}</option>
            </select>
          </div>
          <Num
            id="lt-yearly"
            label={t("leave.policyPage.yearly")}
            value={form.yearly_days}
            onChange={(v) => set({ yearly_days: v, ...(v.trim() !== "" && form.accrual === "none" ? { accrual: "yearly" } : {}) })}
            hint={t("leave.policyPage.yearlyHint")}
          />
          {limited && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="lt-accrual">{t("leave.policyPage.accrual")}</Label>
              <select id="lt-accrual" value={form.accrual} onChange={(e) => set({ accrual: e.target.value })} className={SELECT_CLASS}>
                <option value="yearly">{t("leave.policyPage.accrualYearly")}</option>
                <option value="monthly">{t("leave.policyPage.accrualMonthly")}</option>
              </select>
            </div>
          )}
          {limited && (
            <>
              <Num
                id="lt-sen-years"
                label={t("leave.policyPage.seniorityYears")}
                value={form.seniority_every_years}
                onChange={(v) => set({ seniority_every_years: v })}
                step="1"
              />
              <Num id="lt-sen-days" label={t("leave.policyPage.seniorityDays")} value={form.seniority_extra_days} onChange={(v) => set({ seniority_extra_days: v })} />
            </>
          )}
          <Num
            id="lt-eligible"
            label={t("leave.policyPage.eligible")}
            value={form.eligible_after_months}
            onChange={(v) => set({ eligible_after_months: v })}
            step="1"
          />
          <Num id="lt-max" label={t("leave.policyPage.maxDays")} value={form.max_days_per_request} onChange={(v) => set({ max_days_per_request: v })} />
          <Num
            id="lt-doc"
            label={t("leave.policyPage.documentFrom")}
            value={form.attachment_from_days}
            onChange={(v) => set({ attachment_from_days: v })}
            hint={t("leave.policyPage.documentHint")}
          />
          <Num id="lt-notice" label={t("leave.policyPage.notice")} value={form.min_notice_days} onChange={(v) => set({ min_notice_days: v })} step="1" />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="lt-gender">{t("leave.policyPage.gender")}</Label>
            <select id="lt-gender" value={form.gender} onChange={(e) => set({ gender: e.target.value })} className={SELECT_CLASS}>
              <option value="">{t("leave.policyPage.everyone")}</option>
              <option value="female">{t("leave.policyPage.women")}</option>
              <option value="male">{t("leave.policyPage.men")}</option>
            </select>
          </div>
          <Num id="lt-order" label={t("leave.policyPage.order")} value={form.sort_order} onChange={(v) => set({ sort_order: v })} step="1" />
          <div className="flex flex-col gap-2 sm:col-span-2">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.allow_half_day} disabled={form.counts === "calendar_days"} onChange={(e) => set({ allow_half_day: e.target.checked })} />
              {t("leave.policyPage.allowHalf")}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.allowed_during_probation} onChange={(e) => set({ allowed_during_probation: e.target.checked })} />
              {t("leave.policyPage.allowProbation")}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.is_active} onChange={(e) => set({ is_active: e.target.checked })} />
              {t("leave.policyPage.activeHint")}
            </label>
          </div>
          {error && (
            <Alert variant="destructive" className="sm:col-span-2">
              {error}
            </Alert>
          )}
          <DialogFooter className="sm:col-span-2">
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

/** The rules for asking to arrive late or leave early: on or off, paid or not, how many a month. */
function LateEarlySettingsCard() {
  const t = useT();
  const [settings, setSettings] = useState<LateEarlySettings | null>(null);
  const [limit, setLimit] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.leave
      .lateEarlySettings()
      .then((s) => {
        setSettings(s);
        setLimit(s.monthly_limit === null ? "" : String(s.monthly_limit));
      })
      .catch(notifyError);
  }, []);

  async function save(patch: Partial<Omit<LateEarlySettings, "type">>) {
    setSaving(true);
    try {
      const saved = await api.leave.updateLateEarlySettings(patch);
      setSettings(saved);
      setLimit(saved.monthly_limit === null ? "" : String(saved.monthly_limit));
      notifySuccess(t("leave.policyPage.lateEarlySaved"));
    } catch (err) {
      notifyError(err);
    } finally {
      setSaving(false);
    }
  }

  if (!settings) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlarmClock className="size-4" /> {t("leave.shared.lateEarly")}
        </CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:items-end">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={settings.is_active} disabled={saving} onChange={(e) => save({ is_active: e.target.checked })} />
          {t("leave.policyPage.staffCanAsk")}
        </label>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="le-pay">{t("leave.policyPage.excused")}</Label>
          <select
            id="le-pay"
            value={settings.pay_percent}
            disabled={saving}
            onChange={(e) => save({ pay_percent: Number(e.target.value) as 0 | 100 })}
            className={SELECT_CLASS}
          >
            <option value={100}>{t("leave.policyPage.excusedPaid")}</option>
            <option value={0}>{t("leave.policyPage.excusedUnpaid")}</option>
          </select>
        </div>
        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            save({ monthly_limit: limit.trim() === "" ? null : Number(limit) });
          }}
        >
          <div className="flex flex-1 flex-col gap-1.5">
            <Label htmlFor="le-limit">{t("leave.policyPage.monthlyLimit")}</Label>
            <Input
              id="le-limit"
              type="number"
              min={1}
              max={31}
              step={1}
              value={limit}
              onChange={(e) => setLimit(e.target.value)}
              placeholder={t("leave.policyPage.rules.noLimit")}
            />
          </div>
          <Button type="submit" variant="outline" disabled={saving}>
            {t("common.action.save")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

/** One person's balances this year, and a way to add or take days with a reason (carry-over, corrections). */
function BalanceAdjuster({ types }: { types: LeaveType[] }) {
  const t = useT();
  const lang = useLang();
  const [people, setPeople] = useState<{ value: string; label: string }[]>([]);
  const [employeeId, setEmployeeId] = useState("");
  const [year, setYear] = useState(() => String(new Date().getFullYear()));
  const [data, setData] = useState<LeaveBalances | null>(null);
  const [history, setHistory] = useState<LeaveAdjustment[]>([]);
  const [typeId, setTypeId] = useState("");
  const [days, setDays] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [reloads, setReloads] = useState(0);
  const balanceTypes = types.filter((lt) => lt.requires_balance && lt.is_active);

  useEffect(() => {
    api.employees.all().then((list) => setPeople(list.map((e) => ({ value: String(e.id), label: e.name })))).catch(() => setPeople([]));
  }, []);

  useEffect(() => {
    if (!employeeId) return;
    let cancelled = false;
    api.leave.balances({ employeeId: Number(employeeId), year: Number(year) }).then((d) => !cancelled && setData(d)).catch(notifyError);
    api.leave.adjustments(Number(employeeId)).then((h) => !cancelled && setHistory(h)).catch(() => setHistory([]));
    return () => {
      cancelled = true;
    };
  }, [employeeId, year, reloads]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.leave.adjust({ employee_id: Number(employeeId), leave_type_id: Number(typeId || balanceTypes[0]?.id), year: Number(year), days: Number(days), reason });
      notifySuccess(t("leave.policyPage.adjustedToast"), t("common.time.days", { n: `${Number(days) > 0 ? "+" : ""}${days}` }));
      setDays("");
      setReason("");
      setReloads((n) => n + 1);
    } catch (err) {
      notifyError(err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Scale className="size-4" /> {t("leave.policyPage.adjustTitle")}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_8rem]">
          <SearchableSelect options={people} value={employeeId} onChange={setEmployeeId} placeholder={t("leave.shared.choosePerson")} className="h-9 w-full rounded-md" />
          <Input type="number" value={year} min={2000} max={2100} onChange={(e) => setYear(e.target.value)} aria-label={t("common.time.year")} />
        </div>

        {data && employeeId && (
          <>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {data.balances.map((b) => (
                <div key={b.leave_type.id} className="rounded-lg border border-border p-3">
                  <p className="truncate text-xs text-muted-foreground">{b.leave_type.name}</p>
                  <p className="text-lg font-semibold tabular-nums">{t("leave.policyPage.left", { n: b.available })}</p>
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {t("leave.policyPage.earned", { n: b.earned })}{" "}
                    {b.adjustments ? `${t("leave.policyPage.adjusted", { n: `${b.adjustments > 0 ? "+" : ""}${b.adjustments}` })} ` : ""}·{" "}
                    {t("leave.policyPage.used", { n: b.used })} · {t("leave.policyPage.waiting", { n: b.pending })}
                  </p>
                </div>
              ))}
            </div>
            {data.employee.hire_date === null && (
              <Alert variant="warning">{t("leave.policyPage.noHireDate")}</Alert>
            )}

            <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_6rem_2fr_auto] sm:items-end">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="adj-type">{t("leave.policyPage.leave")}</Label>
                <select id="adj-type" value={typeId || String(balanceTypes[0]?.id ?? "")} onChange={(e) => setTypeId(e.target.value)} className={SELECT_CLASS}>
                  {balanceTypes.map((lt) => (
                    <option key={lt.id} value={lt.id}>
                      {lt.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="adj-days">{t("leave.policyPage.days")}</Label>
                <Input id="adj-days" type="number" step="0.5" value={days} onChange={(e) => setDays(e.target.value)} placeholder="+2 / -1" required />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="adj-reason">{t("common.field.reason")}</Label>
                <Input
                  id="adj-reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder={t("leave.policyPage.adjustReasonPlaceholder")}
                  maxLength={255}
                  required
                />
              </div>
              <Button type="submit" disabled={saving || !days || !reason.trim()}>
                {saving ? t("common.message.saving") : t("leave.policyPage.adjust")}
              </Button>
            </form>

            {history.length > 0 && (
              <ul className="flex flex-col gap-1 text-xs text-muted-foreground">
                {history.map((h) => (
                  <li key={h.id}>
                    <span className="font-medium text-foreground tabular-nums">{h.days > 0 ? `+${h.days}` : h.days}</span> {h.leave_type?.name} {h.year} — {h.reason}
                    {h.created_by ? ` · ${h.created_by.name}` : ""} · {new Date(h.created_at).toLocaleDateString(dateLocale(lang))}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default function LeavePolicyPage() {
  const t = useT();
  const lang = useLang();
  const [types, setTypes] = useState<LeaveType[] | null>(null);
  const [reloads, setReloads] = useState(0);
  const [editing, setEditing] = useState<{ type: LeaveType | null } | null>(null);

  useEffect(() => {
    api.leave.types(true).then(setTypes).catch((err) => {
      notifyError(err);
      setTypes([]);
    });
  }, [reloads]);

  const columns: DataTableColumn<LeaveType>[] = [
    {
      id: "name",
      header: t("leave.policyPage.colLeave"),
      primary: true,
      cell: (lt) => (
        <div className="flex flex-col">
          <span className="font-medium">{lt.name}</span>
          {lt.name_km && <span className="text-xs text-muted-foreground">{lt.name_km}</span>}
        </div>
      ),
      sortValue: (lt) => lt.sort_order ?? 9999,
      searchValue: (lt) => [lt.name, lt.name_km, lt.code].filter(Boolean).join(" "),
    },
    {
      id: "pay",
      header: t("leave.policyPage.colPay"),
      cell: (lt) => (
        <Badge variant={lt.pay_percent === 0 ? "secondary" : lt.pay_percent < 100 ? "warning" : "success"}>
          {lt.pay_percent === 0 ? t("leave.shared.unpaid") : `${lt.pay_percent}%`}
        </Badge>
      ),
      sortValue: (lt) => lt.pay_percent,
    },
    { id: "rules", header: t("leave.policyPage.colRules"), cell: (lt) => <span className="text-muted-foreground">{rules(lt, lang) || "—"}</span>, fullWidthOnMobile: true },
    {
      id: "active",
      header: t("common.field.status"),
      cell: (lt) => <Badge variant={lt.is_active ? "success" : "secondary"}>{lt.is_active ? t("common.status.active") : t("leave.policyPage.off")}</Badge>,
      sortValue: (lt) => (lt.is_active ? 0 : 1),
    },
  ];

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <PageHeader
        title={t("leave.policyPage.title")}
        description={t("leave.policyPage.description")}
        action={
          <Button onClick={() => setEditing({ type: null })}>
            <Plus className="size-4" />
            {t("leave.policyPage.addType")}
          </Button>
        }
      />
      <Alert variant="info" title={t("leave.policyPage.lawTitle")}>
        {t("leave.policyPage.lawBody")}
      </Alert>
      <DataTable
        data={types}
        getRowId={(lt) => lt.id}
        columns={columns}
        onRowClick={(lt) => setEditing({ type: lt })}
        searchPlaceholder={t("leave.policyPage.search")}
        emptyState={{ icon: Scale, title: t("leave.policyPage.empty"), description: t("leave.policyPage.emptyHint") }}
      />
      <LateEarlySettingsCard />
      {types && <BalanceAdjuster types={types} />}
      {editing && (
        <TypeDialog
          key={editing.type?.id ?? "new"}
          type={editing.type}
          open
          onOpenChange={(o) => !o && setEditing(null)}
          onSaved={() => setReloads((n) => n + 1)}
        />
      )}
    </div>
  );
}
