"use client";

import { useEffect, useMemo, useState } from "react";
import { AlarmClock, Loader2, Paperclip } from "lucide-react";
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
import { api, ApiError, type EmployeeRequest, type LateEarlyPreview } from "@/lib/api";
import { notifyError, notifySuccess } from "@/lib/notify";
import { cn } from "@/lib/utils";

type Kind = "late" | "early";

function todayIso(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

/**
 * Asking to arrive late or leave early on one day ("I'll be in at 09:00").
 * Once approved, that day is judged against the approved time. The server
 * says, as the form is filled in, how many minutes it is, the usual time,
 * and how many of this month's allowance are used.
 */
export function LateEarlyRequestDialog({
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
  const [employeeId, setEmployeeId] = useState<string>(selfEmployeeId ? String(selfEmployeeId) : "");
  const [kind, setKind] = useState<Kind>("late");
  const [date, setDate] = useState(todayIso);
  const [time, setTime] = useState("");
  const [reason, setReason] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [approveNow, setApproveNow] = useState(false);
  const [preview, setPreview] = useState<{ key: string; data: LateEarlyPreview | null; error: string | null } | null>(null);
  const [saving, setSaving] = useState(false);

  const forSomeoneElse = employeeId !== "" && Number(employeeId) !== selfEmployeeId;
  const input = useMemo(
    () => (employeeId && date && /^\d{2}:\d{2}$/.test(time) ? { employee_id: Number(employeeId), date, kind, time } : null),
    [employeeId, date, kind, time],
  );
  const inputKey = JSON.stringify(input);

  useEffect(() => {
    if (!open || !input) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      api.requests
        .previewLateEarly(input)
        .then((data) => !cancelled && setPreview({ key: inputKey, data, error: null }))
        .catch((err) => !cancelled && setPreview({ key: inputKey, data: null, error: err instanceof ApiError ? err.message : "Couldn't check this." }));
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [open, input, inputKey]);

  const current = preview?.key === inputKey ? preview : null;
  const checking = input !== null && current === null;
  const problems = Object.values(current?.data?.problems ?? {});
  const canSend = !saving && !checking && Boolean(current?.data) && problems.length === 0 && reason.trim() !== "";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input) return;
    setSaving(true);
    try {
      const created = await api.requests.createLateEarly(
        { ...input, reason: reason.trim(), approve: forSomeoneElse && approveNow ? true : undefined },
        file,
      );
      notifySuccess(
        created.status === "approved" ? `${created.label} recorded` : `${created.label} request sent`,
        created.waiting_on ? `${created.waiting_on.name} will review it.` : created.status === "approved" ? undefined : "An approver will review it.",
      );
      onCreated(created);
      onOpenChange(false);
      setTime("");
      setReason("");
      setFile(null);
      setApproveNow(false);
    } catch (err) {
      notifyError(err);
    } finally {
      setSaving(false);
    }
  }

  const d = current?.data;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Late arrival / Early leave</DialogTitle>
          <DialogDescription>Ask before (or on) the day. Once approved, you won&apos;t be marked late or early for it.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {people && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="le-employee">For</Label>
              <SearchableSelect
                id="le-employee"
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

          <div className="grid grid-cols-2 gap-1 rounded-lg border border-border bg-card p-0.5" role="radiogroup" aria-label="Late or early">
            {(
              [
                ["late", "Arrive late"],
                ["early", "Leave early"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={kind === value}
                onClick={() => setKind(value)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  kind === value ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="le-date">Date</Label>
              <Input id="le-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="le-time">{kind === "late" ? "I'll arrive at" : "I'll leave at"}</Label>
              <Input id="le-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} required />
            </div>
          </div>

          {input && (
            <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm" aria-live="polite">
              {checking || !current ? (
                <p className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="size-3.5 animate-spin" /> Checking…
                </p>
              ) : current.error ? (
                <p className="text-destructive">{current.error}</p>
              ) : d ? (
                <div className="flex flex-col gap-1">
                  {d.minutes > 0 && (
                    <p className="flex items-center gap-2 font-medium">
                      <AlarmClock className="size-4 text-primary" />
                      {d.minutes} min {kind === "late" ? "late" : "early"}
                      {d.expected && <span className="font-normal text-muted-foreground">(usual {kind === "late" ? "start" : "end"} {d.expected})</span>}
                    </p>
                  )}
                  {d.monthly_limit !== null && (
                    <p className="text-xs text-muted-foreground">
                      {d.used_this_month} of {d.monthly_limit} used this month
                    </p>
                  )}
                </div>
              ) : null}
            </div>
          )}

          {problems.length > 0 && (
            <Alert variant="warning" title="Can't send this yet">
              <ul className="list-disc pl-4">
                {problems.map((message) => (
                  <li key={message}>{message}</li>
                ))}
              </ul>
            </Alert>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="le-reason">Reason</Label>
            <Textarea id="le-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={1000} placeholder="e.g. Taking my child to the hospital" required />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="le-file">Document (optional)</Label>
            <label htmlFor="le-file" className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-input px-3 py-2 text-sm text-muted-foreground">
              <Paperclip className="size-4" />
              <span className="truncate">{file ? file.name : "Choose a file or take a photo"}</span>
            </label>
            <input
              id="le-file"
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
                <span className="block text-xs text-muted-foreground">For one you are recording for them, e.g. they called in this morning.</span>
              </span>
            </label>
          )}

          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
            <Button type="submit" disabled={!canSend}>
              {saving ? "Sending…" : forSomeoneElse && approveNow ? "Record it" : "Send request"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
