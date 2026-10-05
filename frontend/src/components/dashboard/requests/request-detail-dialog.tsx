"use client";

import { useState } from "react";
import { Ban, Check, FileText, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useMe } from "@/contexts/me-context";
import { api, photoSrc, type EmployeeRequest } from "@/lib/api";
import { notifyError, notifySuccess } from "@/lib/notify";
import { REQUEST_STATUS, dateList, requestAmount, requestDates } from "@/lib/requests";

function when(iso: string | null): string {
  return iso ? new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "";
}

/**
 * One request in full — what, when, why, the file, and its history — with
 * the actions this viewer may take: approve or reject (a "no" needs a
 * reason the employee can read), or cancel.
 */
export function RequestDetailDialog({
  request,
  onOpenChange,
  onChanged,
}: {
  request: EmployeeRequest | null;
  onOpenChange: (open: boolean) => void;
  onChanged: (request: EmployeeRequest) => void;
}) {
  const confirm = useConfirm();
  const { me } = useMe();
  // Your own (or one you sent for someone): withdrawing needs no reason.
  const isOwn = request !== null && (request.employee.id === me?.employee?.id || request.requested_by?.id === me?.user.id);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [needsReason, setNeedsReason] = useState(false);

  function close(open: boolean) {
    if (!open) {
      setNotes("");
      setNeedsReason(false);
    }
    onOpenChange(open);
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
          ? await api.requests.approve(request.id, notes.trim())
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
              </div>

              {r.reason && <p className="rounded-md bg-muted/50 px-3 py-2">{r.reason}</p>}

              {r.attachments.map((file) => (
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
              ))}

              <ul className="flex flex-col gap-1 border-l-2 border-border pl-3 text-xs text-muted-foreground">
                <li>
                  Sent {when(r.created_at)}
                  {r.requested_by && r.requested_by.name !== r.employee.name ? ` by ${r.requested_by.name}` : ""}
                </li>
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

            {(r.can.decide || r.can.cancel) && (
              <DialogFooter>
                {r.can.cancel && (
                  <Button variant="outline" onClick={() => act("cancel")} disabled={busy} className="sm:mr-auto">
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
