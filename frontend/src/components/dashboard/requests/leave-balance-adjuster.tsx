"use client";

import { useEffect, useState } from "react";
import { Scale, UserSearch } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { FormField, FormSection } from "@/components/dashboard/shared/form-section";
import { api, type LeaveAdjustment, type LeaveBalances, type LeaveType } from "@/lib/api";
import { dateLocale, useLang, useT } from "@/lib/i18n";
import { notifyError, notifySuccess } from "@/lib/notify";
import { cn } from "@/lib/utils";

const SELECT_CLASS = "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

/** One person's balances for a year, and a way to add or take days with a reason (carry-over, corrections). */
export function LeaveBalanceAdjuster({ types }: { types: LeaveType[] }) {
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

  const signed = (n: number) => (n > 0 ? `+${n}` : String(n));

  return (
    <FormSection icon={Scale} tone="from-purple-500 to-indigo-500" title={t("leave.policyPage.adjustTitle")} hint={t("leave.policyPage.adjustHint")}>
      {/* Who and which year. */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_8rem]">
        <SearchableSelect options={people} value={employeeId} onChange={setEmployeeId} placeholder={t("leave.shared.choosePerson")} className="h-9 w-full rounded-md" />
        <Input type="number" value={year} min={2000} max={2100} onChange={(e) => setYear(e.target.value)} aria-label={t("common.time.year")} />
      </div>

      {!employeeId || !data ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
          <UserSearch className="size-6" />
          {t("leave.policyPage.pickPerson")}
        </div>
      ) : (
        <>
          {/* Balances: what's left, big; a quiet bar of how much is used. */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {data.balances.map((b) => {
              const total = b.earned + (b.adjustments ?? 0);
              const usedShare = total > 0 ? Math.min(100, ((b.used + b.pending) / total) * 100) : 0;
              return (
                <div key={b.leave_type.id} className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3">
                  <p className="truncate text-sm font-medium">{b.leave_type.name}</p>
                  <p className="text-2xl font-semibold tabular-nums">{t("leave.policyPage.left", { n: b.available })}</p>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary/50" style={{ width: `${usedShare}%` }} />
                  </div>
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {t("leave.policyPage.earned", { n: b.earned })}
                    {b.adjustments ? ` · ${t("leave.policyPage.adjusted", { n: signed(b.adjustments) })}` : ""} · {t("leave.policyPage.used", { n: b.used })} ·{" "}
                    {t("leave.policyPage.waiting", { n: b.pending })}
                  </p>
                </div>
              );
            })}
          </div>
          {data.employee.hire_date === null && <Alert variant="warning">{t("leave.policyPage.noHireDate")}</Alert>}

          {/* Add or take days. */}
          <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-3 rounded-lg bg-muted/50 p-3 sm:grid-cols-[1fr_6rem_2fr_auto] sm:items-end">
            <FormField id="adj-type" label={t("leave.policyPage.leave")}>
              <select id="adj-type" value={typeId || String(balanceTypes[0]?.id ?? "")} onChange={(e) => setTypeId(e.target.value)} className={cn(SELECT_CLASS, "bg-card")}>
                {balanceTypes.map((lt) => (
                  <option key={lt.id} value={lt.id}>
                    {lt.name}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField id="adj-days" label={t("leave.policyPage.days")}>
              <Input id="adj-days" type="number" step="0.5" value={days} onChange={(e) => setDays(e.target.value)} placeholder="+2 / -1" required className="bg-card" />
            </FormField>
            <FormField id="adj-reason" label={t("common.field.reason")}>
              <Input
                id="adj-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={t("leave.policyPage.adjustReasonPlaceholder")}
                maxLength={255}
                required
                className="bg-card"
              />
            </FormField>
            <Button type="submit" disabled={saving || !days || !reason.trim()}>
              {saving ? t("common.message.saving") : t("leave.policyPage.adjust")}
            </Button>
          </form>

          {/* Past adjustments: + in soft green, − in soft red. */}
          {history.length > 0 && (
            <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
              {history.map((h) => (
                <li key={h.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                  <span
                    className={cn(
                      "w-12 shrink-0 rounded-full py-0.5 text-center text-xs font-semibold tabular-nums",
                      h.days > 0 ? "bg-success/12 text-success" : "bg-destructive/10 text-destructive",
                    )}
                  >
                    {signed(h.days)}
                  </span>
                  <span className="min-w-0 flex-1 truncate">
                    <span className="font-medium">{h.leave_type?.name}</span> {h.year} — {h.reason}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {h.created_by ? `${h.created_by.name} · ` : ""}
                    {new Date(h.created_at).toLocaleDateString(dateLocale(lang))}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </FormSection>
  );
}
