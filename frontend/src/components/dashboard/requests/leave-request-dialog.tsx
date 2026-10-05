"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarCheck, Loader2, Paperclip } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
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
import { Textarea } from "@/components/ui/textarea";
import { api, ApiError, type DayPart, type EmployeeRequest, type LeavePreview, type LeaveType } from "@/lib/api";
import { notifyError, notifySuccess } from "@/lib/notify";
import { DAY_PART_LABEL, dateList, dayCount } from "@/lib/requests";
import { cn } from "@/lib/utils";

const SELECT_CLASS = "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none";

function todayIso(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

/**
 * Asking for leave. Every change asks the server what the request would
 * come to — the days it takes (holidays and days off inside are free), the
 * balance before and after, and anything that would stop it — so nobody
 * finds out only after sending.
 *
 * `people`: when given (someone who approves for a branch), the request can
 * be for one of them, and approved straight away.
 */
export function LeaveRequestDialog({
  open,
  onOpenChange,
  onCreated,
  selfEmployeeId,
  people,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (request: EmployeeRequest) => void;
  selfEmployeeId: number | null;
  people?: { id: number; name: string }[];
}) {
  const [types, setTypes] = useState<LeaveType[] | null>(null);
  const [employeeId, setEmployeeId] = useState<string>(selfEmployeeId ? String(selfEmployeeId) : "");
  const [typeId, setTypeId] = useState("");
  const [start, setStart] = useState(todayIso);
  const [end, setEnd] = useState(todayIso);
  const [part, setPart] = useState<DayPart>("full");
  const [reason, setReason] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [approveNow, setApproveNow] = useState(false);
  const [preview, setPreview] = useState<{ key: string; data: LeavePreview | null; error: string | null } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || types) return;
    api.leave
      .types()
      .then((list) => {
        setTypes(list);
        setTypeId((current) => current || String(list[0]?.id ?? ""));
      })
      .catch(() => setTypes([]));
  }, [open, types]);

  const type = types?.find((t) => String(t.id) === typeId) ?? null;
  const forSomeoneElse = employeeId !== "" && Number(employeeId) !== selfEmployeeId;
  const halfDayPossible = Boolean(type?.allow_half_day) && start === end;
  const dayPart: DayPart = halfDayPossible ? part : "full";

  const input = useMemo(
    () =>
      typeId && employeeId && start && end
        ? {
            employee_id: Number(employeeId),
            leave_type_id: Number(typeId),
            start_date: start,
            end_date: end < start ? start : end,
            day_part: dayPart,
          }
        : null,
    [typeId, employeeId, start, end, dayPart],
  );
  const inputKey = JSON.stringify(input);

  // What the request would come to, asked a moment after the last change.
  useEffect(() => {
    if (!open || !input) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      api.requests
        .preview(input)
        .then((data) => !cancelled && setPreview({ key: inputKey, data, error: null }))
        .catch((err) => !cancelled && setPreview({ key: inputKey, data: null, error: err instanceof ApiError ? err.message : "Couldn't check these dates." }));
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [open, input, inputKey]);

  const current = preview?.key === inputKey ? preview : null;
  const checking = input !== null && current === null;
  // A missing file is only a problem until one is chosen.
  const problems = Object.entries(current?.data?.problems ?? {}).filter(([field]) => !(field === "attachment" && file));
  const needsFile = Boolean(current?.data?.attachment_required);
  const canSend = !saving && !checking && Boolean(current?.data) && problems.length === 0 && (!needsFile || file !== null);

  function changeStart(value: string) {
    setStart(value);
    // Moving the start past the end drags the end along (a one-day request stays one day).
    if (!end || value > end || start === end) setEnd(value);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input) return;
    setSaving(true);
    setError(null);
    try {
      const created = await api.requests.create(
        { ...input, reason: reason.trim() || undefined, approve: forSomeoneElse && approveNow ? true : undefined },
        file,
      );
      notifySuccess(
        created.status === "approved" ? "Leave recorded" : "Leave request sent",
        created.status === "approved" ? `${created.employee.name} · ${dayCount(created.days)}` : created.waiting_on ? `${created.waiting_on.name} will review it.` : "An approver will review it.",
      );
      onCreated(created);
      onOpenChange(false);
      setReason("");
      setFile(null);
      setApproveNow(false);
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      notifyError(err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Ask for leave</DialogTitle>
          <DialogDescription>Only working days count — holidays and days off inside the dates are free.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {people && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="leave-employee">For</Label>
              <SearchableSelect
                id="leave-employee"
                options={[
                  ...(selfEmployeeId ? [{ value: String(selfEmployeeId), label: "Myself" }] : []),
                  ...people.filter((p) => p.id !== selfEmployeeId).map((p) => ({ value: String(p.id), label: p.name })),
                ]}
                value={employeeId}
                onChange={setEmployeeId}
                placeholder="Choose a person"
                clearable={false}
                className="h-9 w-full rounded-md"
              />
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="leave-type">Type of leave</Label>
            <select id="leave-type" value={typeId} onChange={(e) => setTypeId(e.target.value)} className={SELECT_CLASS} disabled={!types}>
              {(types ?? []).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                  {t.name_km ? ` · ${t.name_km}` : ""}
                  {t.pay_percent === 0 ? " (unpaid)" : t.pay_percent < 100 ? ` (${t.pay_percent}% pay)` : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="leave-start">From</Label>
              <Input id="leave-start" type="date" value={start} onChange={(e) => changeStart(e.target.value)} required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="leave-end">To</Label>
              <Input id="leave-end" type="date" value={end} min={start} onChange={(e) => setEnd(e.target.value)} required />
            </div>
          </div>

          {halfDayPossible && (
            <div className="inline-flex self-start rounded-lg border border-border bg-card p-0.5" role="radiogroup" aria-label="Part of the day">
              {(["full", "am", "pm"] as DayPart[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  role="radio"
                  aria-checked={part === p}
                  onClick={() => setPart(p)}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                    part === p ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {DAY_PART_LABEL[p]}
                </button>
              ))}
            </div>
          )}

          {/* What it comes to — live. */}
          <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm" aria-live="polite">
            {checking || !current ? (
              <p className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" /> Checking the dates…
              </p>
            ) : current.error ? (
              <p className="text-destructive">{current.error}</p>
            ) : current.data ? (
              <div className="flex flex-col gap-1.5">
                <p className="flex items-center gap-2 font-medium">
                  <CalendarCheck className="size-4 text-primary" />
                  {current.data.total > 0 ? `Takes ${dayCount(current.data.total)}` : "Takes no working days"}
                </p>
                {current.data.days.length > 0 && <p className="text-xs text-muted-foreground">{dateList(current.data.days)}</p>}
                {current.data.balances.map((b) => (
                  <p key={b.year} className="text-xs">
                    {b.leave_type.name} {b.year}: <span className="font-medium tabular-nums">{b.available}</span> left
                    {" → "}
                    <span className={cn("font-medium tabular-nums", b.after < 0 && "text-destructive")}>{b.after}</span> after
                  </p>
                ))}
              </div>
            ) : null}
          </div>

          {problems.length > 0 && (
            <Alert variant="warning" title="Can't send this yet">
              <ul className="list-disc pl-4">
                {problems.map(([field, message]) => (
                  <li key={field}>{message}</li>
                ))}
              </ul>
            </Alert>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="leave-reason">Reason (optional)</Label>
            <Textarea id="leave-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={1000} placeholder="e.g. Family wedding in Siem Reap" />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="leave-file">
              {needsFile ? "Document (required)" : "Document (optional)"}
              <span className="ml-1 font-normal text-muted-foreground">— e.g. a medical certificate; PDF or photo, up to 10 MB</span>
            </Label>
            <label
              htmlFor="leave-file"
              className={cn(
                "flex cursor-pointer items-center gap-2 rounded-lg border border-dashed px-3 py-2 text-sm",
                needsFile && !file ? "border-warning text-warning" : "border-input text-muted-foreground",
              )}
            >
              <Paperclip className="size-4" />
              <span className="truncate">{file ? file.name : "Choose a file or take a photo"}</span>
            </label>
            <input
              id="leave-file"
              type="file"
              accept="application/pdf,image/jpeg,image/png,image/webp"
              className="sr-only"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>

          {forSomeoneElse && (
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-0.5" checked={approveNow} onChange={(e) => setApproveNow(e.target.checked)} />
              <span>
                Approve it now
                <span className="block text-xs text-muted-foreground">For leave you are recording for them, e.g. a sick call this morning.</span>
              </span>
            </label>
          )}

          {error && <Alert variant="destructive">{error}</Alert>}

          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
            <Button type="submit" disabled={!canSend}>
              {saving ? "Sending…" : forSomeoneElse && approveNow ? "Record leave" : "Send request"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
