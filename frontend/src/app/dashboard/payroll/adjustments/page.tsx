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
import { KIND_HINTS, KIND_LABELS, currentMonth, money, monthLabel, previousMonth } from "@/components/dashboard/payroll/shared";
import { useMe } from "@/contexts/me-context";
import { api, ApiError, type PayKind, type PayrollAdjustment } from "@/lib/api";
import { adjustmentImport } from "@/lib/excel-specs/payroll";
import { notifyError, notifySuccess } from "@/lib/notify";

const SELECT_CLASS = "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none";

function AddDialog({ month, onOpenChange, onSaved }: { month: string; onOpenChange: (o: boolean) => void; onSaved: () => void }) {
  const [people, setPeople] = useState<{ value: string; label: string; currency: string | null }[]>([]);
  const [employeeId, setEmployeeId] = useState("");
  const [kind, setKind] = useState<PayKind>("earning");
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [taxable, setTaxable] = useState(true);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const currency = people.find((p) => p.value === employeeId)?.currency;

  useEffect(() => {
    api.employees
      .all()
      .then((list) => setPeople(list.map((e) => ({ value: String(e.id), label: e.name, currency: e.salary_currency ?? null }))))
      .catch(() => setPeople([]));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api.payroll.createAdjustment({ employee_id: Number(employeeId), month, kind, name: name.trim(), amount: Number(amount), taxable, reason: reason.trim() || null });
      notifySuccess("Adjustment added", name.trim());
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
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Add adjustment</DialogTitle>
            <DialogDescription>A one-off amount on {monthLabel(month)}&apos;s payslip: a bonus, commission, penalty or back pay.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-1.5">
            <Label>Employee</Label>
            <SearchableSelect options={people} value={employeeId} onChange={setEmployeeId} placeholder="Choose an employee" className="h-9 w-full rounded-md" />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="adj-kind">Type</Label>
              <select id="adj-kind" className={SELECT_CLASS} value={kind} onChange={(e) => setKind(e.target.value as PayKind)}>
                {(Object.keys(KIND_LABELS) as PayKind[]).map((k) => (
                  <option key={k} value={k}>
                    {KIND_LABELS[k]}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">{KIND_HINTS[kind]}</p>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="adj-amount">Amount{currency ? ` (${currency})` : ""}</Label>
              <Input id="adj-amount" type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="adj-name">Name on payslip</Label>
            <Input id="adj-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} placeholder="e.g. Sales commission" required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="adj-reason">Reason</Label>
            <Input id="adj-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={255} placeholder="Optional — shown on the payslip" />
          </div>
          {kind === "earning" && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={taxable} onChange={(e) => setTaxable(e.target.checked)} />
              Subject to tax on salary and NSSF
            </label>
          )}
          {error && <Alert variant="destructive">{error}</Alert>}
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
            <Button type="submit" disabled={saving || !employeeId || !name.trim() || !(Number(amount) > 0)}>
              {saving ? "Saving…" : "Add"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function PayrollAdjustmentsPage() {
  const confirm = useConfirm();
  const { me } = useMe();
  const canManage = me?.permissions.includes("payroll.manage") ?? false;
  const [month, setMonth] = useState(previousMonth);
  const [rows, setRows] = useState<PayrollAdjustment[] | null>(null);
  const [reloads, setReloads] = useState(0);
  const [adding, setAdding] = useState(false);
  const [importing, setImporting] = useState(false);
  const spec = useMemo(() => adjustmentImport(month), [month]);

  useEffect(() => {
    let cancelled = false;
    api.payroll
      .adjustments(month)
      .then((list) => !cancelled && setRows(list))
      .catch((err) => {
        notifyError(err);
        setRows([]);
      });
    return () => {
      cancelled = true;
      setRows(null);
    };
  }, [month, reloads]);

  async function remove(a: PayrollAdjustment) {
    const ok = await confirm({ title: `Remove “${a.name}”?`, description: `For ${a.employee?.name ?? "this employee"}, ${monthLabel(a.month)}.`, confirmLabel: "Remove", destructive: true });
    if (!ok) return;
    try {
      await api.payroll.removeAdjustment(a.id);
      setReloads((n) => n + 1);
    } catch (err) {
      notifyError(err);
    }
  }

  const columns: DataTableColumn<PayrollAdjustment>[] = [
    {
      id: "employee",
      header: "Employee",
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
    { id: "name", header: "Item", cell: (a) => <div className="flex flex-col"><span>{a.name}</span>{a.reason && <span className="text-xs text-muted-foreground">{a.reason}</span>}</div> },
    { id: "kind", header: "Type", cell: (a) => <Badge variant={a.kind === "earning" ? "success" : "secondary"}>{KIND_LABELS[a.kind]}</Badge> },
    { id: "amount", header: "Amount", cell: (a) => <span className="tabular-nums">{a.kind === "earning" ? "+" : "−"} {Number(a.amount).toLocaleString("en-US", { maximumFractionDigits: 2 })}</span>, sortValue: (a) => Number(a.amount) },
    { id: "by", header: "Added by", hideOnMobile: true, cell: (a) => <span className="text-muted-foreground">{a.created_by?.name ?? "—"}</span> },
    {
      id: "actions",
      header: "",
      hideOnMobile: true,
      cell: (a) =>
        canManage && (
          <Button variant="ghost" size="sm" className="text-destructive" onClick={() => remove(a)}>
            Remove
          </Button>
        ),
    },
  ];

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Adjustments"
        description="One-off amounts for a month — anything your rules don't cover. They're added the next time the month is calculated."
        action={
          canManage && (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => setImporting(true)}>
                <FileSpreadsheet className="size-4" />
                Import from Excel
              </Button>
              <Button onClick={() => setAdding(true)}>
                <Plus className="size-4" />
                Add adjustment
              </Button>
            </div>
          )
        }
      />
      <div className="flex max-w-xs flex-col gap-1.5">
        <Label htmlFor="adj-month">Month</Label>
        <Input id="adj-month" type="month" value={month} max={currentMonth()} onChange={(e) => e.target.value && setMonth(e.target.value)} />
      </div>
      <DataTable
        data={rows}
        getRowId={(a) => a.id}
        columns={columns}
        searchPlaceholder="Search adjustments…"
        emptyState={{ icon: HandCoins, title: `No adjustments for ${monthLabel(month)}`, description: "Add a bonus, commission or penalty, or import a spreadsheet." }}
      />
      <p className="text-xs text-muted-foreground">Amounts are in each employee&apos;s salary currency (e.g. {money(35, "USD")} or {money(140000, "KHR")}).</p>

      {adding && <AddDialog month={month} onOpenChange={setAdding} onSaved={() => setReloads((n) => n + 1)} />}
      <ExcelImportDialog spec={spec} open={importing} onOpenChange={setImporting} onImported={() => setReloads((n) => n + 1)} />
    </div>
  );
}
