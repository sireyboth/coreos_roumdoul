"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, RotateCcw, Save } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { PageHeader } from "@/components/dashboard/layout/page-header";
import { COLOR_STYLE, StatusChip, TEXT_SWATCH } from "@/components/dashboard/shared/status-chip";
import { useMe } from "@/contexts/me-context";
import { setStatusCodes, useStatusCodes } from "@/hooks/use-status-codes";
import {
  api,
  ApiError,
  DAY_COLORS,
  DAY_STATUSES,
  LEAVE_COLORS,
  TEXT_COLORS,
  type DayColor,
  type DayStatus,
  type LeaveColor,
  type ReportCodes,
  type StatusLook,
  type TextColor,
} from "@/lib/api";
import { useT } from "@/lib/i18n";
import { notifyError, notifySuccess } from "@/lib/notify";
import { cn } from "@/lib/utils";

const SELECT_CLASS = "h-9 rounded-md border border-input bg-transparent px-2 text-sm outline-none disabled:opacity-50";

type Draft = { statuses: Record<DayStatus, StatusLook<DayColor>>; leave: Record<number, StatusLook<LeaveColor>> };

/** The page's working copy: day statuses as they are, each leave type's look (no code yet = empty). */
function toDraft(codes: ReportCodes): Draft {
  return {
    statuses: structuredClone(codes.statuses),
    leave: Object.fromEntries(codes.leave.map((l) => [l.id, { code: l.report_code ?? "", color: l.color, text: l.text, bold: l.bold }])),
  };
}

/** One status's look: code, background, text colour, bold, and how it will show. */
function LookRow<C extends DayColor | LeaveColor>({
  meaning,
  note,
  look,
  colors,
  unpaid,
  invalid,
  disabled,
  onChange,
}: {
  meaning: string;
  note?: string;
  look: StatusLook<C>;
  colors: readonly C[];
  unpaid?: boolean;
  invalid: boolean;
  disabled: boolean;
  onChange: (look: StatusLook<C>) => void;
}) {
  const t = useT();
  const set = (patch: Partial<StatusLook<C>>) => onChange({ ...look, ...patch });

  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-3 border-b border-border py-3 last:border-b-0 lg:grid-cols-[minmax(10rem,1fr)_5rem_auto_9rem_auto_3.5rem]">
      <div className="min-w-0">
        <p className="text-sm font-medium">{meaning}</p>
        {note && <p className="text-xs text-muted-foreground">{note}</p>}
      </div>
      {/* On a phone the preview sits beside the name; on a wide screen it closes the row. */}
      <StatusChip look={{ ...look, code: look.code || "?" }} unpaid={unpaid} className="justify-self-end lg:order-last" />

      <Input
        aria-label={`${meaning} · ${t("attendance.statusCodes.code")}`}
        value={look.code}
        onChange={(e) => set({ code: e.target.value.toUpperCase() })}
        maxLength={3}
        disabled={disabled}
        aria-invalid={invalid || undefined}
        className="w-20 text-center font-semibold uppercase"
      />

      <div role="radiogroup" aria-label={`${meaning} · ${t("attendance.statusCodes.background")}`} className="col-span-2 flex flex-wrap gap-1.5 lg:col-span-1">
        {colors.map((c) => (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={look.color === c}
            aria-label={t(`attendance.statusCodes.colors.${c}`)}
            title={t(`attendance.statusCodes.colors.${c}`)}
            disabled={disabled}
            onClick={() => set({ color: c })}
            className={cn(
              "size-6 rounded-full ring-offset-2 ring-offset-background transition disabled:cursor-not-allowed",
              COLOR_STYLE[c].dot,
              look.color === c ? "ring-2 ring-foreground" : "opacity-60 hover:opacity-100",
            )}
          />
        ))}
      </div>

      <label className="flex items-center gap-2">
        <span className={cn("size-4 shrink-0 rounded-full", TEXT_SWATCH[look.text])} aria-hidden />
        <select
          aria-label={`${meaning} · ${t("attendance.statusCodes.text")}`}
          value={look.text}
          disabled={disabled}
          onChange={(e) => set({ text: e.target.value as TextColor })}
          className={cn(SELECT_CLASS, "w-full")}
        >
          {TEXT_COLORS.map((c) => (
            <option key={c} value={c}>
              {t(`attendance.statusCodes.textColors.${c}`)}
            </option>
          ))}
        </select>
      </label>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={look.bold} disabled={disabled} onChange={(e) => set({ bold: e.target.checked })} />
        <span className="font-bold">{t("attendance.statusCodes.bold")}</span>
      </label>
    </div>
  );
}

/**
 * Attendance → Status codes: how every status looks, in one place. The
 * report, calendar, attendance list, Excel and PDF all draw from what is saved
 * here (see lib/attendance/status-codes.ts), so one change shows everywhere.
 */
export default function StatusCodesPage() {
  const t = useT();
  const confirm = useConfirm();
  const { me } = useMe();
  const canManage = me?.permissions.includes("attendance.manage") ?? false;
  const codes = useStatusCodes();
  const [draft, setDraft] = useState<Draft>(() => toDraft(codes));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The company's own codes arrive after the first draw (defaults until then), and come back after a save or reset.
  const [shown, setShown] = useState(codes);
  if (shown !== codes) {
    setShown(codes);
    setDraft(toDraft(codes));
  }

  // One code, one meaning — said before saving; the server checks the same.
  const problems = useMemo(() => {
    const all = [
      ...DAY_STATUSES.map((s) => ({ key: `s:${s}`, code: draft.statuses[s].code.trim() })),
      ...codes.leave.map((l) => ({ key: `l:${l.id}`, code: draft.leave[l.id]?.code.trim() ?? "" })),
    ];
    const count = new Map<string, number>();
    all.forEach((a) => a.code && count.set(a.code, (count.get(a.code) ?? 0) + 1));
    const bad = new Set(all.filter((a) => (a.key.startsWith("s:") && !a.code) || (count.get(a.code) ?? 0) > 1).map((a) => a.key));
    const duplicate = [...count].find(([, n]) => n > 1)?.[0];
    const message = DAY_STATUSES.some((s) => !draft.statuses[s].code.trim())
      ? t("attendance.statusCodes.empty")
      : duplicate
        ? t("attendance.statusCodes.duplicate", { code: duplicate })
        : null;
    return { bad, message };
  }, [draft, codes.leave, t]);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      // Leave types left without a code keep showing "LV"; only those with one are sent.
      const leave = Object.fromEntries(Object.entries(draft.leave).filter(([, l]) => l.code.trim()));
      setStatusCodes(await api.attendance.updateReportCodes({ statuses: draft.statuses, leave }));
      notifySuccess(t("attendance.statusCodes.saved"));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("common.message.saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  async function reset() {
    const ok = await confirm({
      title: t("attendance.statusCodes.resetTitle"),
      description: t("attendance.statusCodes.resetText"),
      confirmLabel: t("attendance.statusCodes.reset"),
      destructive: true,
    });
    if (!ok) return;
    try {
      setStatusCodes(await api.attendance.resetReportCodes());
      notifySuccess(t("attendance.statusCodes.wasReset"));
    } catch (err) {
      notifyError(err);
    }
  }

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <Link href="/dashboard/attendance" className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" />
        {t("attendance.page.title")}
      </Link>
      <PageHeader
        title={t("attendance.statusCodes.title")}
        description={t("attendance.statusCodes.description")}
        action={
          canManage && (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={reset} disabled={saving}>
                <RotateCcw className="size-4" />
                {t("attendance.statusCodes.reset")}
              </Button>
              <Button onClick={save} disabled={saving || problems.message !== null}>
                <Save className="size-4" />
                {saving ? t("common.message.saving") : t("common.action.save")}
              </Button>
            </div>
          )
        }
      />

      <Alert variant="info">{t("attendance.statusCodes.meaningNote")}</Alert>
      {!canManage && <Alert variant="warning">{t("attendance.statusCodes.readOnly")}</Alert>}
      {problems.message && <Alert variant="destructive">{problems.message}</Alert>}
      {error && <Alert variant="destructive">{error}</Alert>}

      {/* Everything at once, as the report's legend will show it. */}
      <div className="sticky top-2 z-20 flex flex-wrap items-center gap-1.5 rounded-xl border border-border bg-card/95 px-4 py-3 shadow-sm backdrop-blur">
        <span className="mr-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("attendance.statusCodes.preview")}</span>
        {DAY_STATUSES.map((s) => (
          <StatusChip key={s} look={{ ...draft.statuses[s], code: draft.statuses[s].code || "?" }} title={t(`attendance.statusCodes.status.${s}`)} />
        ))}
        <span className="mx-1 h-5 w-px bg-border" aria-hidden />
        {codes.leave
          .filter((l) => draft.leave[l.id]?.code)
          .map((l) => (
            <StatusChip key={l.id} look={draft.leave[l.id]} unpaid={l.pay_percent === 0} title={l.name} />
          ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("attendance.statusCodes.daySection")}</CardTitle>
          <CardDescription>{t("attendance.statusCodes.codeHint")}</CardDescription>
        </CardHeader>
        <CardContent>
          {DAY_STATUSES.map((s) => (
            <LookRow
              key={s}
              meaning={t(`attendance.statusCodes.status.${s}`)}
              look={draft.statuses[s]}
              colors={DAY_COLORS}
              invalid={problems.bad.has(`s:${s}`)}
              disabled={!canManage}
              onChange={(look) => setDraft((d) => ({ ...d, statuses: { ...d.statuses, [s]: look } }))}
            />
          ))}
        </CardContent>
      </Card>

      {codes.leave.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t("attendance.statusCodes.leaveSection")}</CardTitle>
            <CardDescription>{t("attendance.statusCodes.leaveHint")}</CardDescription>
          </CardHeader>
          <CardContent>
            {codes.leave.map((l) => (
              <LookRow
                key={l.id}
                meaning={l.name}
                note={[l.name_km, l.pay_percent === 0 && t("attendance.statusCodes.unpaid"), !l.is_active && t("attendance.statusCodes.inactive")].filter(Boolean).join(" · ") || undefined}
                look={draft.leave[l.id] ?? { code: "", color: l.color, text: l.text, bold: l.bold }}
                colors={LEAVE_COLORS}
                unpaid={l.pay_percent === 0}
                invalid={problems.bad.has(`l:${l.id}`)}
                disabled={!canManage}
                onChange={(look) => setDraft((d) => ({ ...d, leave: { ...d.leave, [l.id]: look } }))}
              />
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
