"use client";

import { useState } from "react";
import { Ban, Check, FileText, Pencil, Trash2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useMe } from "@/contexts/me-context";
import { api, photoSrc, type EmployeeRequest, type LeaveType } from "@/lib/api";
import { notifyError, notifySuccess } from "@/lib/notify";
import { DAY_PART_LABEL, REQUEST_STATUS, dateList, requestAmount, requestDates, shortDate } from "@/lib/requests";
import { cn } from "@/lib/utils";

function when(iso: string | null): string {
  return iso ? new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "";
}

const SELECT_CLASS ="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none";

export const DELETE_REQUESTS_WARNING =
  "Removes the request, its file and its notifications for good. Approved leave goes back to the balance and attendance is worked out again. Use this to clear test data; to undo a real request, cancel it so the history stays.";

/**
 * One request in full — what, when, why, the file, and its history — with
 * the actions this viewer may take: approve or reject (a "no" needs a
 * reason the employee can read), or cancel.
 */
export function RequestDetailDialog({
  request,
  onOpenChange,
  onChanged,
  onDeleted,
}: {
  request: EmployeeRequest | null;
  onOpenChange: (open: boolean) => void;
  onChanged: (request: EmployeeRequest) => void;
  onDeleted?: (id: number) => void;
}) {
  const confirm = useConfirm();
  const { me } = useMe();
  // Your own (or one you sent for someone): withdrawing needs no reason.
  const isOwn = request !== null && (request.employee.id === me?.employee?.id || request.requested_by?.id === me?.user.id);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [needsReason, setNeedsReason] = useState(false);
  // Days the approver switched (date → paid); the rest pay as the leave type says.
  const [payChanges, setPayChanges] = useState<Record<string, boolean>>({});
  const [payFor, setPayFor] = useState<number | null>(null);
  // The remark when fixing the paid days of approved leave.
  const [payNotes, setPayNotes] = useState("");
  // Correcting the leave type: the form while open, and the types to pick from (loaded on first use).
  const [typeEdit, setTypeEdit] = useState<{ typeId: string; notes: string } | null>(null);
  const [types, setTypes] = useState<LeaveType[] | null>(null);
  if ((request?.id ?? null) !== payFor) {
    setPayFor(request?.id ?? null);
    setPayChanges({});
    setPayNotes("");
    setTypeEdit(null);
  }
  const isPaid = (d: { date: string; paid: boolean }) => payChanges[d.date] ?? d.paid;
  // Approved leave: a tick differs from what's saved, so there is something to save.
  const payDirty = request?.dates.some((d) => isPaid(d) !== d.paid) ?? false;

  async function savePay() {
    if (!request) return;
    setBusy(true);
    try {
      const updated = await api.requests.editPay(request.id, request.dates.filter(isPaid).map((d) => d.date), payNotes.trim());
      notifySuccess("Paid days saved", `${updated.employee.name} · ${updated.pay_note ?? `paid as ${updated.label} says`}`);
      setPayChanges({});
      setPayNotes("");
      onChanged(updated);
    } catch (err) {
      notifyError(err);
    } finally {
      setBusy(false);
    }
  }

  function close(open: boolean) {
    if (!open) {
      setNotes("");
      setNeedsReason(false);
      setPayChanges({});
      setPayNotes("");
      setTypeEdit(null);
    }
    onOpenChange(open);
  }

  function startTypeEdit() {
    if (!request?.leave_type) return;
    setTypeEdit({ typeId: "", notes: "" });
    if (!types) {
      api.leave
        .types()
        .then(setTypes)
        .catch((err) => {
          notifyError(err);
          setTypeEdit(null);
        });
    }
  }

  async function saveType() {
    if (!request || !typeEdit?.typeId) return;
    const to = types?.find((t) => String(t.id) === typeEdit.typeId);
    if (
      request.status === "approved" &&
      !(await confirm({
        title: `Change to ${to?.name ?? "this type"}?`,
        description:
          "This leave is already approved: its days move to the new type's balance and attendance is worked out again." +
          (request.pay_note ? " The paid days you chose go back to what the new type pays." : ""),
        confirmLabel: "Change type",
      }))
    ) {
      return;
    }

    setBusy(true);
    try {
      const updated = await api.requests.changeType(request.id, Number(typeEdit.typeId), typeEdit.notes.trim());
      notifySuccess("Leave type changed", `${updated.employee.name} · ${request.label} → ${updated.label}`);
      setTypeEdit(null);
      setPayChanges({});
      onChanged(updated);
    } catch (err) {
      notifyError(err);
    } finally {
      setBusy(false);
    }
  }

  async function act(action: "approve" | "reject" | "cancel") {
    if (!request) return;
    // A "no", or cancelling someone else's leave, always says why.
    if (!notes.trim() && (action === "reject" || (action === "cancel" && !isOwn))) {
      setNeedsReason(true);
      return;
    }
    if (
      action === "cancel" &&
      !(await confirm({
        title: `Cancel this ${request.label.toLowerCase()}?`,
        description:
          request.status !== "approved"
            ? "It will no longer wait for approval."
            : request.type === "leave"
              ? "The days go back to the balance and attendance is worked out again."
              : "Attendance is worked out again without it.",
        confirmLabel: "Cancel it",
        cancelLabel: "Keep it",
        destructive: true,
      }))
    ) {
      return;
    }

    setBusy(true);
    try {
      const updated =
        action === "approve"
          ? await api.requests.approve(
              request.id,
              notes.trim(),
              // Sent only when something was switched, so a plain approval stays plain.
              Object.keys(payChanges).length > 0 ? request.dates.filter(isPaid).map((d) => d.date) : undefined,
            )
          : action === "reject"
            ? await api.requests.reject(request.id, notes.trim())
            : await api.requests.cancel(request.id, notes.trim());
      notifySuccess(
        `${updated.label} ${action === "approve" ? "approved" : action === "reject" ? "rejected" : "cancelled"}`,
        `${updated.employee.name} · ${requestDates(updated)}`,
      );
      onChanged(updated);
      close(false);
    } catch (err) {
      notifyError(err);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!request) return;
    const ok = await confirm({ title: `Delete this ${request.label.toLowerCase()}?`, description: DELETE_REQUESTS_WARNING, destructive: true });
    if (!ok) return;

    setBusy(true);
    try {
      await api.requests.deleteMany([request.id]);
      notifySuccess(`${request.label} deleted`, `${request.employee.name} · ${requestDates(request)}`);
      onDeleted?.(request.id);
      close(false);
    } catch (err) {
      notifyError(err);
    } finally {
      setBusy(false);
    }
  }

  const r = request;
  const status = r ? REQUEST_STATUS[r.status] : null;

  return (
    <Dialog open={r !== null} onOpenChange={close}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        {r && status && (
          <>
            <DialogHeader>
              <DialogTitle className="flex flex-wrap items-center gap-2">
                {r.label}
                <Badge variant={status.tone}>{status.label}</Badge>
                {r.can.change_type && !typeEdit && (
                  <Button variant="outline" size="sm" onClick={startTypeEdit} disabled={busy} className="ml-auto mr-6 border-primary/40 text-primary hover:bg-primary/10 hover:text-primary">
                    <Pencil className="size-3.5" />
                    Change type
                  </Button>
                )}
              </DialogTitle>
              <DialogDescription>
                {r.employee.name}
                {r.employee.branch ? ` · ${r.employee.branch}` : ""}
                {r.leave_type?.name_km ? ` · ${r.leave_type.name_km}` : ""}
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-3 text-sm">
              <div>
                <p className="font-medium">
                  {requestDates(r)} · {requestAmount(r)}
                </p>
                {r.dates.length > 0 && r.start_date !== r.end_date && <p className="text-xs text-muted-foreground">{dateList(r.dates)}</p>}
                {r.leave_type && r.leave_type.pay_percent < 100 && (
                  <p className="text-xs text-muted-foreground">{r.leave_type.pay_percent === 0 ? "Unpaid" : `${r.leave_type.pay_percent}% pay`}</p>
                )}
                {r.pay_note && <p className="text-xs font-medium text-foreground">{r.pay_note}</p>}
              </div>

              {typeEdit && (
                <div className="flex flex-col gap-2.5 rounded-md border border-border px-3 py-3">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="change-type">Change {r.label.toLowerCase()} to</Label>
                    <select
                      id="change-type"
                      value={typeEdit.typeId}
                      onChange={(e) => setTypeEdit({ ...typeEdit, typeId: e.target.value })}
                      className={SELECT_CLASS}
                      disabled={!types || busy}
                    >
                      <option value="">{types ? "Choose a leave type" : "Loading…"}</option>
                      {(types ?? [])
                        .filter((t) => t.id !== r.leave_type?.id)
                        .map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                            {t.name_km ? ` · ${t.name_km}` : ""}
                            {t.pay_percent === 0 ? " (unpaid)" : t.pay_percent < 100 ? ` (${t.pay_percent}% pay)` : ""}
                          </option>
                        ))}
                    </select>
                  </div>
                  <Input
                    value={typeEdit.notes}
                    onChange={(e) => setTypeEdit({ ...typeEdit, notes: e.target.value })}
                    maxLength={500}
                    placeholder="Remark to the employee (optional), e.g. Was ill, not on holiday"
                    aria-label="Remark to the employee"
                    disabled={busy}
                  />
                  <p className="text-xs text-muted-foreground">
                    The same dates are checked again for the new type. {r.status === "approved" ? "Balance and attendance follow the change." : "It still waits for approval."}
                  </p>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={() => setTypeEdit(null)} disabled={busy}>
                      Cancel
                    </Button>
                    <Button size="sm" onClick={saveType} disabled={busy || !typeEdit.typeId}>
                      Save type
                    </Button>
                  </div>
                </div>
              )}

              {r.can.set_pay && r.dates.length > 0 && (
                <fieldset className="flex flex-col gap-2 rounded-md border border-border px-3 py-2.5">
                  <legend className="px-1 text-xs font-medium">Paid days</legend>
                  <p className="text-xs text-muted-foreground">
                    Attendance keeps this as {r.label.toLowerCase()}; payroll pays the days ticked. The leave balance doesn&apos;t change.
                    {r.status === "approved" && " Already approved: fix the ticks and save — not possible once the month is locked."}
                  </p>
                  <div className="flex flex-col gap-1.5">
                    {r.dates.map((d) => (
                      <label key={d.date} className="flex items-center justify-between gap-3 text-sm">
                        <span className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={isPaid(d)}
                            disabled={busy}
                            onChange={(e) => setPayChanges((prev) => ({ ...prev, [d.date]: e.target.checked }))}
                          />
                          {shortDate(d.date)}
                          {d.part !== "full" && <span className="text-muted-foreground">· {DAY_PART_LABEL[d.part].toLowerCase()}</span>}
                        </span>
                        <span className={cn("text-xs", isPaid(d) ? "text-foreground" : "text-muted-foreground")}>{isPaid(d) ? "Paid" : "Unpaid"}</span>
                      </label>
                    ))}
                  </div>
                  {r.status === "approved" && payDirty && (
                    <div className="flex flex-col gap-2 border-t border-border pt-2.5">
                      <Input
                        value={payNotes}
                        onChange={(e) => setPayNotes(e.target.value)}
                        maxLength={500}
                        placeholder="Remark to the employee (optional), e.g. Only Monday was agreed"
                        aria-label="Remark to the employee"
                        disabled={busy}
                      />
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => setPayChanges({})} disabled={busy}>
                          Undo
                        </Button>
                        <Button size="sm" onClick={savePay} disabled={busy}>
                          Save paid days
                        </Button>
                      </div>
                    </div>
                  )}
                </fieldset>
              )}

              {r.reason && <p className="rounded-md bg-muted/50 px-3 py-2">{r.reason}</p>}

              {r.attachments.map((file) =>
                file.mime.startsWith("image/") ? (
                  <figure key={file.id} className="flex flex-col gap-1.5">
                    <a href={photoSrc(file.url) ?? "#"} target="_blank" rel="noopener noreferrer" title="Open full size">
                      {/* eslint-disable-next-line @next/next/no-img-element -- signed backend URL, next/image can't optimize it */}
                      <img
                        src={photoSrc(file.url) ?? undefined}
                        alt={file.name}
                        className="max-h-80 w-full rounded-md border border-border bg-muted/30 object-contain transition-opacity hover:opacity-90"
                      />
                    </a>
                    <figcaption className="truncate text-xs text-muted-foreground">{file.name}</figcaption>
                  </figure>
                ) : (
                  <a
                    key={file.id}
                    href={photoSrc(file.url) ?? "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 font-medium text-primary hover:underline"
                  >
                    <FileText className="size-4" />
                    {file.name}
                  </a>
                ),
              )}

              <ul className="flex flex-col gap-1 border-l-2 border-border pl-3 text-xs text-muted-foreground">
                <li>
                  Sent {when(r.created_at)}
                  {r.requested_by && r.requested_by.name !== r.employee.name ? ` by ${r.requested_by.name}` : ""}
                </li>
                {r.pay_changed && (
                  <li>
                    Paid days changed from {r.pay_changed.from} to {r.pay_changed.to} by {r.pay_changed.by_name} {when(r.pay_changed.at)}
                    {r.pay_changed.notes ? ` — “${r.pay_changed.notes}”` : ""}
                  </li>
                )}
                {r.changed_from && (
                  <li>
                    Changed from {r.changed_from.leave_type} to {r.label} by {r.changed_from.by_name} {when(r.changed_from.at)}
                    {r.changed_from.notes ? ` — “${r.changed_from.notes}”` : ""}
                  </li>
                )}
                {r.status === "pending" && <li>Waiting for {r.waiting_on ? r.waiting_on.name : "an approver for their branch"}</li>}
                {r.decided_by && (
                  <li>
                    {r.status === "rejected" ? "Rejected" : "Approved"} by {r.decided_by.name} {when(r.decided_at)}
                    {r.decision_notes ? ` — “${r.decision_notes}”` : ""}
                  </li>
                )}
                {r.cancelled_by && (
                  <li>
                    Cancelled by {r.cancelled_by.name} {when(r.cancelled_at)}
                    {r.cancel_reason ? ` — “${r.cancel_reason}”` : ""}
                  </li>
                )}
              </ul>

              {(r.can.decide || r.can.cancel) && (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="request-notes">{r.can.decide || !isOwn ? "Remark to the employee" : "Reason (optional)"}</Label>
                  <Textarea
                    id="request-notes"
                    value={notes}
                    onChange={(e) => {
                      setNotes(e.target.value);
                      setNeedsReason(false);
                    }}
                    maxLength={500}
                    aria-invalid={needsReason}
                    placeholder={r.can.decide ? "Optional when approving, needed when rejecting" : isOwn ? "" : "Needed — say why it is cancelled"}
                  />
                  {needsReason && <p className="text-xs text-destructive">Add a remark — the employee will see it.</p>}
                </div>
              )}
            </div>

            {(r.can.decide || r.can.cancel || r.can.delete) && (
              <DialogFooter>
                {r.can.delete && (
                  <Button variant="destructive" onClick={remove} disabled={busy} className="sm:mr-auto">
                    <Trash2 className="size-3.5" />
                    Delete
                  </Button>
                )}
                {r.can.cancel && (
                  <Button variant="outline" onClick={() => act("cancel")} disabled={busy} className={cn(!r.can.delete && "sm:mr-auto")}>
                    <Ban className="size-3.5" />
                    Cancel request
                  </Button>
                )}
                {r.can.decide && (
                  <>
                    <Button variant="outline" onClick={() => act("reject")} disabled={busy}>
                      <X className="size-3.5" />
                      Reject
                    </Button>
                    <Button onClick={() => act("approve")} disabled={busy}>
                      <Check className="size-3.5" />
                      Approve
                    </Button>
                  </>
                )}
              </DialogFooter>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
