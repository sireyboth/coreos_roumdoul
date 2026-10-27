"use client";

import { useEffect, useMemo, useState } from "react";
import { FileSpreadsheet, HandCoins, Plus } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { ExcelImportDialog } from "@/components/dashboard/excel-import-dialog";
import { PageHeader } from "@/components/dashboard/page-header";
import { PayrollGuideButton } from "@/components/dashboard/payroll/payroll-guide";
import { currentMonth, dateInMonth, dateLabel, money, monthLabel, previousMonth } from "@/components/dashboard/payroll/shared";
import { useMe } from "@/contexts/me-context";
import { useApi } from "@/hooks/use-api";
import { api, ApiError, type PayKind, type PayrollAdjustment } from "@/lib/api";
import { adjustmentImport } from "@/lib/excel-specs/payroll";
import { notifyError, notifySuccess } from "@/lib/notify";
import { cn } from "@/lib/utils";
import { LEFT_STATUSES } from "@/components/dashboard/employee-form";
import { useLang, useT } from "@/lib/i18n";

const SELECT_CLASS = "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none";

type Person = { value: string; label: string; currency: string | null; branchId: number | null; branch: string | null };

/** Who an adjustment goes to: one person, everyone in a branch, or everyone. */
type Target = "one" | "branch" | "all";

const KINDS: PayKind[] = ["earning", "deduction", "net_deduction"];

function AddDialog({ month, onOpenChange, onSaved }: { month: string; onOpenChange: (o: boolean) => void; onSaved: () => void }) {
  const t = useT();
  const [people, setPeople] = useState<Person[]>([]);
  const [target, setTarget] = useState<Target>("one");
  const [employeeId, setEmployeeId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [date, setDate] = useState(() => dateInMonth(month));
  const [kind, setKind] = useState<PayKind>("earning");
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [taxable, setTaxable] = useState(true);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.employees
      .all()
      .then((list) =>
        setPeople(
          list
            // People who have left aren't paid any more.
            .filter((e) => !LEFT_STATUSES.includes(e.employment_status ?? ""))
            .map((e) => ({ value: String(e.id), label: e.name, currency: e.salary_currency ?? null, branchId: e.branch?.id ?? null, branch: e.branch?.name ?? null })),
        ),
      )
      .catch(() => setPeople([]));
  }, []);

  const branches = [...new Map(people.filter((p) => p.branchId).map((p) => [String(p.branchId), p.branch ?? ""])).entries()].map(([value, label]) => ({ value, label }));
  const recipients = target === "all" ? people : target === "branch" ? people.filter((p) => String(p.branchId) === branchId) : people.filter((p) => p.value === employeeId);
  const currencies = [...new Set(recipients.map((p) => p.currency).filter(Boolean))];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const base = { date, kind, name: name.trim(), amount: Number(amount), taxable, reason: reason.trim() || null };
    try {
      if (target === "one") {
        await api.payroll.createAdjustment({ ...base, employee_id: Number(employeeId) });
        notifySuccess(t("payroll.adjustments.dialog.added"), name.trim());
      } else {
        const { created } = await api.payroll.createAdjustments({ ...base, employee_ids: recipients.map((p) => Number(p.value)) });
        notifySuccess(
          t("payroll.adjustments.dialog.addedMany"),
          t(created === 1 ? "payroll.adjustments.dialog.addedManyOne" : "payroll.adjustments.dialog.addedManyOther", { name: name.trim(), n: created }),
        );
      }
      onSaved();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("payroll.adjustments.dialog.saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{t("payroll.adjustments.add")}</DialogTitle>
            <DialogDescription>{t("payroll.adjustments.dialog.description")}</DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-1.5">
            <Label>{t("payroll.adjustments.dialog.applyTo")}</Label>
            <div className="inline-flex self-start rounded-lg border border-border bg-card p-0.5" role="radiogroup">
              {(
                [
                  ["one", t("payroll.adjustments.dialog.one")],
                  ["branch", t("payroll.adjustments.dialog.branch")],
                  ["all", t("payroll.adjustments.dialog.all")],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={target === value}
                  onClick={() => setTarget(value)}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                    target === value ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {target === "one" && (
            <SearchableSelect options={people} value={employeeId} onChange={setEmployeeId} placeholder={t("payroll.adjustments.dialog.chooseEmployee")} className="h-9 w-full rounded-md" />
          )}
          {target === "branch" && (
            <SearchableSelect options={branches} value={branchId} onChange={setBranchId} placeholder={t("payroll.adjustments.dialog.chooseBranch")} className="h-9 w-full rounded-md" />
          )}
          {target !== "one" && (
            <p className="-mt-2 text-xs text-muted-foreground">
              {t(recipients.length === 1 ? "payroll.adjustments.dialog.recipientsOne" : "payroll.adjustments.dialog.recipientsOther", { n: recipients.length })}
            </p>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="adj-kind">{t("common.field.type")}</Label>
              <select id="adj-kind" className={SELECT_CLASS} value={kind} onChange={(e) => setKind(e.target.value as PayKind)}>
                {KINDS.map((k) => (
                  <option key={k} value={k}>
                    {t(`payroll.shared.kind.${k}`)}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">{t(`payroll.shared.kindHint.${kind}`)}</p>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="adj-amount">{currencies.length === 1 ? t("payroll.adjustments.dialog.amountIn", { currency: currencies[0] ?? "" }) : t("common.field.amount")}</Label>
              <Input id="adj-amount" type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required />
              {currencies.length > 1 && <p className="text-xs text-warning">{t("payroll.adjustments.dialog.mixedCurrency")}</p>}
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="adj-date">{t("common.field.date")}</Label>
            <Input id="adj-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required className="sm:max-w-48" />
            <p className="text-xs text-muted-foreground">{t("payroll.adjustments.dialog.dateHint")}</p>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="adj-name">{t("payroll.adjustments.dialog.name")}</Label>
            <Input id="adj-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} placeholder={t("payroll.adjustments.dialog.namePlaceholder")} required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="adj-reason">{t("common.field.reason")}</Label>
            <Input id="adj-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={255} placeholder={t("payroll.adjustments.dialog.reasonPlaceholder")} />
          </div>
          {kind === "earning" && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={taxable} onChange={(e) => setTaxable(e.target.checked)} />
              {t("payroll.adjustments.dialog.taxable")}
            </label>
          )}
          {error && <Alert variant="destructive">{error}</Alert>}
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>{t("common.action.cancel")}</DialogClose>
            <Button type="submit" disabled={saving || recipients.length === 0 || !date || !name.trim() || !(Number(amount) > 0)}>
              {saving ? t("payroll.adjustments.dialog.saving") : target === "one" ? t("common.action.add") : t("payroll.adjustments.dialog.addFor", { n: recipients.length })}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function PayrollAdjustmentsPage() {
  const confirm = useConfirm();
  const t = useT();
  const lang = useLang();
  const { me } = useMe();
  const canManage = me?.permissions.includes("payroll.manage") ?? false;
  const [month, setMonth] = useState(previousMonth);
  const [adding, setAdding] = useState(false);
  const [importing, setImporting] = useState(false);
  const spec = useMemo(() => adjustmentImport(dateInMonth(month)), [month]);

  const { data, error, reload } = useApi(() => api.payroll.adjustments(month), [month], { notify: true });
  const rows = data ?? (error ? [] : null);

  async function remove(a: PayrollAdjustment) {
    const ok = await confirm({
      title: t("payroll.adjustments.removeTitle", { name: a.name }),
      description: t("payroll.adjustments.removeText", { employee: a.employee?.name ?? t("payroll.adjustments.thisEmployee"), date: dateLabel(a.date, lang) }),
      confirmLabel: t("common.action.remove"),
      destructive: true,
    });
    if (!ok) return;
    try {
      await api.payroll.removeAdjustment(a.id);
      reload();
    } catch (err) {
      notifyError(err);
    }
  }

  const columns: DataTableColumn<PayrollAdjustment>[] = [
    {
      id: "employee",
      header: t("common.field.employee"),
      primary: true,
      cell: (a) => (
        <div className="flex flex-col">
          <span className="font-medium">{a.employee?.name ?? "—"}</span>
          <span className="text-xs text-muted-foreground">{a.employee?.employee_code ?? ""}</span>
        </div>
      ),
      searchValue: (a) => [a.employee?.name, a.employee?.employee_code, a.name].filter(Boolean).join(" "),
      sortValue: (a) => a.employee?.name ?? "",
    },
    { id: "date", header: t("common.field.date"), cell: (a) => <span className="tabular-nums">{dateLabel(a.date, lang)}</span>, sortValue: (a) => a.date },
    { id: "name", header: t("payroll.adjustments.colItem"), cell: (a) => <div className="flex flex-col"><span>{a.name}</span>{a.reason && <span className="text-xs text-muted-foreground">{a.reason}</span>}</div> },
    { id: "kind", header: t("common.field.type"), cell: (a) => <Badge variant={a.kind === "earning" ? "success" : "secondary"}>{t(`payroll.shared.kind.${a.kind}`)}</Badge> },
    { id: "amount", header: t("common.field.amount"), cell: (a) => <span className="tabular-nums">{a.kind === "earning" ? "+" : "−"} {Number(a.amount).toLocaleString("en-US", { maximumFractionDigits: 2 })}</span>, sortValue: (a) => Number(a.amount) },
    { id: "by", header: t("payroll.adjustments.colAddedBy"), hideOnMobile: true, cell: (a) => <span className="text-muted-foreground">{a.created_by?.name ?? "—"}</span> },
    {
      id: "actions",
      header: "",
      hideOnMobile: true,
      cell: (a) =>
        canManage && (
          <Button variant="ghost" size="sm" className="text-destructive" onClick={() => remove(a)}>
            {t("common.action.remove")}
          </Button>
        ),
    },
  ];

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <PageHeader
        title={t("payroll.adjustments.title")}
        description={t("payroll.adjustments.description")}
        action={
          <div className="flex flex-wrap gap-2">
            <PayrollGuideButton topic="adjustments" />
            {canManage && (
              <>
                <Button variant="outline" onClick={() => setImporting(true)}>
                  <FileSpreadsheet className="size-4" />
                  {t("payroll.adjustments.importExcel")}
                </Button>
                <Button onClick={() => setAdding(true)}>
                  <Plus className="size-4" />
                  {t("payroll.adjustments.add")}
                </Button>
              </>
            )}
          </div>
        }
      />
      <div className="flex max-w-xs flex-col gap-1.5">
        <Label htmlFor="adj-month">{t("payroll.adjustments.month")}</Label>
        <Input id="adj-month" type="month" value={month} max={currentMonth()} onChange={(e) => e.target.value && setMonth(e.target.value)} />
      </div>
      <DataTable
        data={rows}
        getRowId={(a) => a.id}
        columns={columns}
        searchPlaceholder={t("payroll.adjustments.search")}
        emptyState={{ icon: HandCoins, title: t("payroll.adjustments.emptyTitle", { month: monthLabel(month, lang) }), description: t("payroll.adjustments.emptyText") }}
      />
      <p className="text-xs text-muted-foreground">{t("payroll.adjustments.currencyNote", { usd: money(35, "USD"), khr: money(140000, "KHR") })}</p>

      {adding && <AddDialog month={month} onOpenChange={setAdding} onSaved={reload} />}
      <ExcelImportDialog spec={spec} open={importing} onOpenChange={setImporting} onImported={reload} />
    </div>
  );
}
