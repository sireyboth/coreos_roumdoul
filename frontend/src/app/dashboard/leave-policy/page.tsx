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
import { PageHeader } from "@/components/dashboard/page-header";
import { api, ApiError, type LateEarlySettings, type LeaveAdjustment, type LeaveBalances, type LeaveType, type LeaveTypeInput } from "@/lib/api";
import { notifyError, notifySuccess } from "@/lib/notify";

const SELECT_CLASS = "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none";

/** A type's rules in one line: "18 days a year, earned monthly · after 12 months · half days". */
function rules(t: LeaveType): string {
  return [
    t.requires_balance && t.yearly_days
      ? `${t.yearly_days} days a year, ${t.accrual === "monthly" ? "earned monthly" : "all in January"}`
      : "No limit",
    t.seniority_every_years && t.seniority_extra_days ? `+${t.seniority_extra_days} per ${t.seniority_every_years} years` : null,
    t.eligible_after_months ? `after ${t.eligible_after_months} months` : null,
    t.counts === "calendar_days" ? "calendar days" : null,
    t.max_days_per_request ? `max ${t.max_days_per_request} per request` : null,
    t.attachment_from_days ? (t.attachment_from_days <= 1 ? "document always" : `document from ${t.attachment_from_days} days`) : null,
    t.min_notice_days ? `${t.min_notice_days} days' notice` : null,
    t.allow_half_day ? "half days" : null,
    t.gender ? (t.gender === "female" ? "women" : "men") : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

type Form = Record<keyof Omit<LeaveType, "id" | "requires_balance" | "allow_half_day" | "is_active">, string> & {
  requires_balance: boolean;
  allow_half_day: boolean;
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
      notifySuccess(type ? "Leave type saved" : "Leave type added", form.name);
      onSaved();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{type ? type.name : "New leave type"}</DialogTitle>
          <DialogDescription>Changes apply to new requests and to balances from now on.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {!type && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="lt-code">Code</Label>
              <Input id="lt-code" value={form.code} onChange={(e) => set({ code: e.target.value })} placeholder="e.g. study" pattern="[a-z0-9_]+" required />
              <p className="text-xs text-muted-foreground">Lowercase letters, numbers and _. Can&apos;t be changed later.</p>
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="lt-name">Name</Label>
            <Input id="lt-name" value={form.name} onChange={(e) => set({ name: e.target.value })} required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="lt-km">Name in Khmer</Label>
            <Input id="lt-km" value={form.name_km} onChange={(e) => set({ name_km: e.target.value })} />
          </div>
          <Num id="lt-pay" label="Pay (%)" value={form.pay_percent} onChange={(v) => set({ pay_percent: v })} step="1" hint="0 = unpaid, 50 = half pay." />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="lt-counts">Days counted</Label>
            <select id="lt-counts" value={form.counts} onChange={(e) => set({ counts: e.target.value, ...(e.target.value === "calendar_days" ? { allow_half_day: false } : {}) })} className={SELECT_CLASS}>
              <option value="work_days">Working days only</option>
              <option value="calendar_days">Every calendar day</option>
            </select>
          </div>
          <Num
            id="lt-yearly"
            label="Days allowed per year"
            value={form.yearly_days}
            onChange={(v) => set({ yearly_days: v, ...(v.trim() !== "" && form.accrual === "none" ? { accrual: "yearly" } : {}) })}
            hint="e.g. 18 for annual, 7 for sick. Empty = no limit."
          />
          {limited && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="lt-accrual">How they are given</Label>
              <select id="lt-accrual" value={form.accrual} onChange={(e) => set({ accrual: e.target.value })} className={SELECT_CLASS}>
                <option value="yearly">All at the start of each year</option>
                <option value="monthly">Earned month by month (1/12 each month)</option>
              </select>
            </div>
          )}
          {limited && (
            <>
              <Num id="lt-sen-years" label="Seniority: every N years" value={form.seniority_every_years} onChange={(v) => set({ seniority_every_years: v })} step="1" />
              <Num id="lt-sen-days" label="…adds days" value={form.seniority_extra_days} onChange={(v) => set({ seniority_extra_days: v })} />
            </>
          )}
          <Num id="lt-eligible" label="Usable after (months of service)" value={form.eligible_after_months} onChange={(v) => set({ eligible_after_months: v })} step="1" />
          <Num id="lt-max" label="Most days per request" value={form.max_days_per_request} onChange={(v) => set({ max_days_per_request: v })} />
          <Num id="lt-doc" label="Document needed from (days)" value={form.attachment_from_days} onChange={(v) => set({ attachment_from_days: v })} hint="1 = always. Empty = never." />
          <Num id="lt-notice" label="Notice (days ahead)" value={form.min_notice_days} onChange={(v) => set({ min_notice_days: v })} step="1" />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="lt-gender">Who can take it</Label>
            <select id="lt-gender" value={form.gender} onChange={(e) => set({ gender: e.target.value })} className={SELECT_CLASS}>
              <option value="">Everyone</option>
              <option value="female">Women</option>
              <option value="male">Men</option>
            </select>
          </div>
          <Num id="lt-order" label="Display order" value={form.sort_order} onChange={(v) => set({ sort_order: v })} step="1" />
          <div className="flex flex-col gap-2 sm:col-span-2">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.allow_half_day} disabled={form.counts === "calendar_days"} onChange={(e) => set({ allow_half_day: e.target.checked })} />
              Allow half days (morning / afternoon)
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.is_active} onChange={(e) => set({ is_active: e.target.checked })} />
              Active — staff can choose it
            </label>
          </div>
          {error && (
            <Alert variant="destructive" className="sm:col-span-2">
              {error}
            </Alert>
          )}
          <DialogFooter className="sm:col-span-2">
            <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** The rules for asking to arrive late or leave early: on or off, paid or not, how many a month. */
function LateEarlySettingsCard() {
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
      notifySuccess("Late arrival / early leave rules saved");
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
          <AlarmClock className="size-4" /> Late arrival / Early leave
        </CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:items-end">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={settings.is_active} disabled={saving} onChange={(e) => save({ is_active: e.target.checked })} />
          Staff can ask for it
        </label>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="le-pay">Excused time</Label>
          <select
            id="le-pay"
            value={settings.pay_percent}
            disabled={saving}
            onChange={(e) => save({ pay_percent: Number(e.target.value) as 0 | 100 })}
            className={SELECT_CLASS}
          >
            <option value={100}>Paid — counted as worked</option>
            <option value={0}>Unpaid — deducted in payroll</option>
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
            <Label htmlFor="le-limit">Most per person per month</Label>
            <Input id="le-limit" type="number" min={1} max={31} step={1} value={limit} onChange={(e) => setLimit(e.target.value)} placeholder="No limit" />
          </div>
          <Button type="submit" variant="outline" disabled={saving}>
            Save
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

/** One person's balances this year, and a way to add or take days with a reason (carry-over, corrections). */
function BalanceAdjuster({ types }: { types: LeaveType[] }) {
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
  const balanceTypes = types.filter((t) => t.requires_balance && t.is_active);

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
      notifySuccess("Balance adjusted", `${Number(days) > 0 ? "+" : ""}${days} days`);
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
          <Scale className="size-4" /> Adjust a balance
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_8rem]">
          <SearchableSelect options={people} value={employeeId} onChange={setEmployeeId} placeholder="Choose a person" className="h-9 w-full rounded-md" />
          <Input type="number" value={year} min={2000} max={2100} onChange={(e) => setYear(e.target.value)} aria-label="Year" />
        </div>

        {data && employeeId && (
          <>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {data.balances.map((b) => (
                <div key={b.leave_type.id} className="rounded-lg border border-border p-3">
                  <p className="truncate text-xs text-muted-foreground">{b.leave_type.name}</p>
                  <p className="text-lg font-semibold tabular-nums">{b.available} left</p>
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {b.earned} earned {b.adjustments ? `${b.adjustments > 0 ? "+" : ""}${b.adjustments} adjusted ` : ""}· {b.used} used · {b.pending} waiting
                  </p>
                </div>
              ))}
            </div>
            {data.employee.hire_date === null && (
              <Alert variant="warning">No hire date on their profile — monthly leave is counted from 1 January and the 12-month wait can&apos;t be checked.</Alert>
            )}

            <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_6rem_2fr_auto] sm:items-end">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="adj-type">Leave</Label>
                <select id="adj-type" value={typeId || String(balanceTypes[0]?.id ?? "")} onChange={(e) => setTypeId(e.target.value)} className={SELECT_CLASS}>
                  {balanceTypes.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="adj-days">Days</Label>
                <Input id="adj-days" type="number" step="0.5" value={days} onChange={(e) => setDays(e.target.value)} placeholder="+2 / -1" required />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="adj-reason">Reason</Label>
                <Input id="adj-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Carried over from last year" maxLength={255} required />
              </div>
              <Button type="submit" disabled={saving || !days || !reason.trim()}>
                {saving ? "Saving…" : "Adjust"}
              </Button>
            </form>

            {history.length > 0 && (
              <ul className="flex flex-col gap-1 text-xs text-muted-foreground">
                {history.map((h) => (
                  <li key={h.id}>
                    <span className="font-medium text-foreground tabular-nums">{h.days > 0 ? `+${h.days}` : h.days}</span> {h.leave_type?.name} {h.year} — {h.reason}
                    {h.created_by ? ` · ${h.created_by.name}` : ""} · {new Date(h.created_at).toLocaleDateString()}
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
      header: "Leave",
      primary: true,
      cell: (t) => (
        <div className="flex flex-col">
          <span className="font-medium">{t.name}</span>
          {t.name_km && <span className="text-xs text-muted-foreground">{t.name_km}</span>}
        </div>
      ),
      sortValue: (t) => t.sort_order ?? 9999,
      searchValue: (t) => [t.name, t.name_km, t.code].filter(Boolean).join(" "),
    },
    {
      id: "pay",
      header: "Pay",
      cell: (t) => <Badge variant={t.pay_percent === 0 ? "secondary" : t.pay_percent < 100 ? "warning" : "success"}>{t.pay_percent === 0 ? "Unpaid" : `${t.pay_percent}%`}</Badge>,
      sortValue: (t) => t.pay_percent,
    },
    { id: "rules", header: "Rules", cell: (t) => <span className="text-muted-foreground">{rules(t) || "—"}</span>, fullWidthOnMobile: true },
    {
      id: "active",
      header: "Status",
      cell: (t) => <Badge variant={t.is_active ? "success" : "secondary"}>{t.is_active ? "Active" : "Off"}</Badge>,
      sortValue: (t) => (t.is_active ? 0 : 1),
    },
  ];

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Leave policy"
        description="The kinds of leave staff can ask for, and how each is earned."
        action={
          <Button onClick={() => setEditing({ type: null })}>
            <Plus className="size-4" />
            Add leave type
          </Button>
        }
      />
      <Alert variant="info" title="Starts from Cambodian Labour Law">
        Annual 18 days a year (1.5 a month, +1 day per 3 years, after 12 months), special leave 7 days, maternity 90 days. Have
        your HR or legal advisor confirm them for your company — everything here can be changed.
      </Alert>
      <DataTable
        data={types}
        getRowId={(t) => t.id}
        columns={columns}
        onRowClick={(t) => setEditing({ type: t })}
        searchPlaceholder="Search leave types…"
        emptyState={{ icon: Scale, title: "No leave types", description: "Add the kinds of leave your staff can ask for." }}
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
