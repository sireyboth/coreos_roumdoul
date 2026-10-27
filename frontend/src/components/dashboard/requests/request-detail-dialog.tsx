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
import { dateLocale, useLang, useT, type Lang } from "@/lib/i18n";
import { DAY_PART_KEY, REQUEST_STATUS, dateList, requestAmount, requestDates, requestLabel, shortDate } from "@/lib/requests";
import { cn } from "@/lib/utils";

function when(iso: string | null, lang: Lang): string {
  return iso ? new Date(iso).toLocaleString(dateLocale(lang), { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "";
}

const SELECT_CLASS ="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none";

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
  const t = useT();
  const lang = useLang();
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
      notifySuccess(t("leave.detail.paidDaysSaved"), `${updated.employee.name} · ${updated.pay_note ?? t("leave.detail.paidAsTypeSays", { label: updated.label })}`);
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
    const to = types?.find((lt) => String(lt.id) === typeEdit.typeId);
    if (
      request.status === "approved" &&
      !(await confirm({
        title: t("leave.detail.confirmTypeTitle", { name: to?.name ?? t("leave.detail.thisType") }),
        description: t("leave.detail.confirmTypeBody") + (request.pay_note ? t("leave.detail.confirmTypePay") : ""),
        confirmLabel: t("leave.detail.changeType"),
      }))
    ) {
      return;
    }

    setBusy(true);
    try {
      const updated = await api.requests.changeType(request.id, Number(typeEdit.typeId), typeEdit.notes.trim());
      notifySuccess(t("leave.detail.typeChanged"), `${updated.employee.name} · ${request.label} → ${updated.label}`);
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
        title: t("leave.detail.cancelTitle", { label: requestLabel(request, lang).toLowerCase() }),
        description:
          request.status !== "approved"
            ? t("leave.detail.cancelPending")
            : request.type === "leave"
              ? t("leave.detail.cancelLeave")
              : t("leave.detail.cancelLateEarly"),
        confirmLabel: t("leave.detail.cancelIt"),
        cancelLabel: t("leave.detail.keepIt"),
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
      const label = requestLabel(updated, lang);
      notifySuccess(
        action === "approve"
          ? t("leave.detail.approved", { label })
          : action === "reject"
            ? t("leave.detail.rejected", { label })
            : t("leave.detail.cancelled", { label }),
        `${updated.employee.name} · ${requestDates(updated, lang)}`,
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
    const ok = await confirm({
      title: t("leave.shared.deleteOne", { label: requestLabel(request, lang).toLowerCase() }),
      description: t("leave.shared.deleteWarning"),
      destructive: true,
    });
    if (!ok) return;

    setBusy(true);
    try {
      await api.requests.deleteMany([request.id]);
      notifySuccess(t("leave.detail.deleted", { label: requestLabel(request, lang) }), `${request.employee.name} · ${requestDates(request, lang)}`);
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
                {requestLabel(r, lang)}
                <Badge variant={status.tone}>{t(status.key)}</Badge>
                {r.can.change_type && !typeEdit && (
                  <Button variant="outline" size="sm" onClick={startTypeEdit} disabled={busy} className="ml-auto mr-6 border-primary/40 text-primary hover:bg-primary/10 hover:text-primary">
                    <Pencil className="size-3.5" />
                    {t("leave.detail.changeType")}
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
                  {requestDates(r, lang)} · {requestAmount(r, lang)}
                </p>
                {r.dates.length > 0 && r.start_date !== r.end_date && <p className="text-xs text-muted-foreground">{dateList(r.dates, undefined, lang)}</p>}
                {r.leave_type && r.leave_type.pay_percent < 100 && (
                  <p className="text-xs text-muted-foreground">
                    {r.leave_type.pay_percent === 0 ? t("leave.shared.unpaid") : t("leave.shared.payPercent", { percent: r.leave_type.pay_percent })}
                  </p>
                )}
                {r.pay_note && <p className="text-xs font-medium text-foreground">{r.pay_note}</p>}
              </div>

              {typeEdit && (
                <div className="flex flex-col gap-2.5 rounded-md border border-border px-3 py-3">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="change-type">{t("leave.detail.changeTo", { label: r.label.toLowerCase() })}</Label>
                    <select
                      id="change-type"
                      value={typeEdit.typeId}
                      onChange={(e) => setTypeEdit({ ...typeEdit, typeId: e.target.value })}
                      className={SELECT_CLASS}
                      disabled={!types || busy}
                    >
                      <option value="">{types ? t("leave.detail.chooseType") : t("common.message.loading")}</option>
                      {(types ?? [])
                        .filter((lt) => lt.id !== r.leave_type?.id)
                        .map((lt) => (
                          <option key={lt.id} value={lt.id}>
                            {lt.name}
                            {lt.name_km ? ` · ${lt.name_km}` : ""}
                            {lt.pay_percent === 0 ? t("leave.shared.unpaidTag") : lt.pay_percent < 100 ? t("leave.shared.payTag", { percent: lt.pay_percent }) : ""}
                          </option>
                        ))}
                    </select>
                  </div>
                  <Input
                    value={typeEdit.notes}
                    onChange={(e) => setTypeEdit({ ...typeEdit, notes: e.target.value })}
                    maxLength={500}
                    placeholder={t("leave.detail.typeRemarkPlaceholder")}
                    aria-label={t("leave.shared.remarkToEmployee")}
                    disabled={busy}
                  />
                  <p className="text-xs text-muted-foreground">
                    {t("leave.detail.typeRecheck")} {r.status === "approved" ? t("leave.detail.typeFollows") : t("leave.detail.typeStillWaits")}
                  </p>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={() => setTypeEdit(null)} disabled={busy}>
                      {t("common.action.cancel")}
                    </Button>
                    <Button size="sm" onClick={saveType} disabled={busy || !typeEdit.typeId}>
                      {t("leave.detail.saveType")}
                    </Button>
                  </div>
                </div>
              )}

              {r.can.set_pay && r.dates.length > 0 && (
                <fieldset className="flex flex-col gap-2 rounded-md border border-border px-3 py-2.5">
                  <legend className="px-1 text-xs font-medium">{t("leave.detail.paidDays")}</legend>
                  <p className="text-xs text-muted-foreground">
                    {t("leave.detail.paidDaysHint", { label: r.label.toLowerCase() })}
                    {r.status === "approved" && t("leave.detail.paidDaysApproved")}
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
                          {shortDate(d.date, lang)}
                          {d.part !== "full" && <span className="text-muted-foreground">· {t(DAY_PART_KEY[d.part]).toLowerCase()}</span>}
                        </span>
                        <span className={cn("text-xs", isPaid(d) ? "text-foreground" : "text-muted-foreground")}>
                          {isPaid(d) ? t("leave.shared.paid") : t("leave.shared.unpaid")}
                        </span>
                      </label>
                    ))}
                  </div>
                  {r.status === "approved" && payDirty && (
                    <div className="flex flex-col gap-2 border-t border-border pt-2.5">
                      <Input
                        value={payNotes}
                        onChange={(e) => setPayNotes(e.target.value)}
                        maxLength={500}
                        placeholder={t("leave.detail.payRemarkPlaceholder")}
                        aria-label={t("leave.shared.remarkToEmployee")}
                        disabled={busy}
                      />
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => setPayChanges({})} disabled={busy}>
                          {t("common.action.undo")}
                        </Button>
                        <Button size="sm" onClick={savePay} disabled={busy}>
                          {t("leave.detail.savePaidDays")}
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
                    <a href={photoSrc(file.url) ?? "#"} target="_blank" rel="noopener noreferrer" title={t("leave.detail.openFull")}>
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
                  {t("leave.detail.sent", { when: when(r.created_at, lang) })}
                  {r.requested_by && r.requested_by.name !== r.employee.name ? t("leave.detail.sentBy", { name: r.requested_by.name }) : ""}
                </li>
                {r.pay_changed && (
                  <li>
                    {t("leave.detail.payChanged", {
                      from: r.pay_changed.from,
                      to: r.pay_changed.to,
                      name: r.pay_changed.by_name,
                      when: when(r.pay_changed.at, lang),
                    })}
                    {r.pay_changed.notes ? ` — “${r.pay_changed.notes}”` : ""}
                  </li>
                )}
                {r.changed_from && (
                  <li>
                    {t("leave.detail.changedFrom", {
                      from: r.changed_from.leave_type,
                      to: r.label,
                      name: r.changed_from.by_name,
                      when: when(r.changed_from.at, lang),
                    })}
                    {r.changed_from.notes ? ` — “${r.changed_from.notes}”` : ""}
                  </li>
                )}
                {r.status === "pending" && (
                  <li>{r.waiting_on ? t("leave.detail.waitingFor", { name: r.waiting_on.name }) : t("leave.detail.waitingForAny")}</li>
                )}
                {r.decided_by && (
                  <li>
                    {t(r.status === "rejected" ? "leave.detail.rejectedBy" : "leave.detail.approvedBy", { name: r.decided_by.name, when: when(r.decided_at, lang) })}
                    {r.decision_notes ? ` — “${r.decision_notes}”` : ""}
                  </li>
                )}
                {r.cancelled_by && (
                  <li>
                    {t("leave.detail.cancelledBy", { name: r.cancelled_by.name, when: when(r.cancelled_at, lang) })}
                    {r.cancel_reason ? ` — “${r.cancel_reason}”` : ""}
                  </li>
                )}
              </ul>

              {(r.can.decide || r.can.cancel) && (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="request-notes">{r.can.decide || !isOwn ? t("leave.shared.remarkToEmployee") : `${t("common.field.reason")} ${t("common.field.optional")}`}</Label>
                  <Textarea
                    id="request-notes"
                    value={notes}
                    onChange={(e) => {
                      setNotes(e.target.value);
                      setNeedsReason(false);
                    }}
                    maxLength={500}
                    aria-invalid={needsReason}
                    placeholder={r.can.decide ? t("leave.detail.remarkPlaceholder") : isOwn ? "" : t("leave.detail.cancelReasonPlaceholder")}
                  />
                  {needsReason && <p className="text-xs text-destructive">{t("leave.detail.remarkMissing")}</p>}
                </div>
              )}
            </div>

            {(r.can.decide || r.can.cancel || r.can.delete) && (
              <DialogFooter>
                {r.can.delete && (
                  <Button variant="destructive" onClick={remove} disabled={busy} className="sm:mr-auto">
                    <Trash2 className="size-3.5" />
                    {t("common.action.delete")}
                  </Button>
                )}
                {r.can.cancel && (
                  <Button variant="outline" onClick={() => act("cancel")} disabled={busy} className={cn(!r.can.delete && "sm:mr-auto")}>
                    <Ban className="size-3.5" />
                    {t("leave.detail.cancelRequest")}
                  </Button>
                )}
                {r.can.decide && (
                  <>
                    <Button variant="outline" onClick={() => act("reject")} disabled={busy}>
                      <X className="size-3.5" />
                      {t("common.action.reject")}
                    </Button>
                    <Button onClick={() => act("approve")} disabled={busy}>
                      <Check className="size-3.5" />
                      {t("common.action.approve")}
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
