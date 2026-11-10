"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Eye, FileText } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { monthLabel } from "@/components/dashboard/payroll/shared";
import { useMe } from "@/contexts/me-context";
import { api, type PayRun, type PayRunDetail, type PayRunReport } from "@/lib/api";
import { payrollPdfHtml } from "@/lib/pdf/payroll";
import { notifyError } from "@/lib/notify";
import { useLang, useT } from "@/lib/i18n";

const SELECT_CLASS = "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none sm:w-auto sm:min-w-64";

/** Breathing room around the report inside the frame (the printed page has its own margins instead). */
const FRAME_STYLE = "<style>body{padding:24px 28px;background:#fff}</style></head>";

/** Pay runs whose period touches the month (a run can cross months, and each pay group has its own). */
function runsInMonth(runs: PayRun[], month: string): PayRun[] {
  const first = `${month}-01`;
  const last = `${month}-31`; // Compared as text, so "-31" is the end of any month.
  return runs.filter((r) => r.period_start <= last && r.period_end >= first).sort((a, b) => (a.pay_group?.name ?? "").localeCompare(b.pay_group?.name ?? "") || a.period_start.localeCompare(b.period_start));
}

/**
 * The payroll report of the month's pay run, shown inside the app to check how
 * the adjustments land. View only: printing and saving stay on the pay run page.
 * Mount it only while open, so each opening loads fresh figures.
 */
export function ReportPreviewDialog({ month, onOpenChange }: { month: string; onOpenChange: (open: boolean) => void }) {
  const t = useT();
  const lang = useLang();
  const { me } = useMe();
  const [runs, setRuns] = useState<PayRun[] | null>(null);
  const [chosen, setChosen] = useState<number | null>(null);
  const [loaded, setLoaded] = useState<{ runId: number; detail: PayRunDetail; report: PayRunReport } | null>(null);

  // The month's runs.
  useEffect(() => {
    api.payroll
      .runs()
      .then((all) => setRuns(runsInMonth(all, month)))
      .catch((err) => {
        notifyError(err);
        setRuns([]);
      });
  }, [month]);

  // The first run until another is picked.
  const runId = chosen ?? runs?.[0]?.id ?? null;

  // The chosen run: its report, plus whether it still needs recalculating.
  useEffect(() => {
    if (runId === null) return;
    let cancelled = false;
    Promise.all([api.payroll.run(runId), api.payroll.runReport(runId)])
      .then(([detail, report]) => !cancelled && setLoaded({ runId, detail, report }))
      .catch(notifyError);
    return () => {
      cancelled = true;
    };
  }, [runId]);

  // Only the chosen run's figures: while another loads, show the placeholder.
  const current = loaded?.runId === runId ? loaded : null;
  const html = current
    ? payrollPdfHtml({ company: me?.company?.name ?? "Business OS", generatedBy: me?.user.name, report: current.report, includePayments: false }).replace("</head>", FRAME_STYLE)
    : null;

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[calc(100dvh-2rem)] flex-col overflow-hidden sm:max-w-6xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="size-4" />
            {t("payroll.adjustments.preview.title", { month: monthLabel(month, lang) })}
          </DialogTitle>
          <DialogDescription>{t("payroll.adjustments.preview.description")}</DialogDescription>
        </DialogHeader>

        {runs === null ? (
          <Skeleton className="min-h-0 flex-1" />
        ) : runs.length === 0 ? (
          <Alert variant="info" title={t("payroll.adjustments.preview.noRun")}>
            {t("payroll.adjustments.preview.noRunText")}
          </Alert>
        ) : (
          <>
            {runs.length > 1 && (
              <select aria-label={t("payroll.adjustments.preview.chooseRun")} className={SELECT_CLASS} value={runId ?? ""} onChange={(e) => setChosen(Number(e.target.value))}>
                {runs.map((r) => (
                  <option key={r.id} value={r.id}>
                    {(r.pay_group?.name ?? t("payroll.run.payroll")) + " · " + r.period_label}
                  </option>
                ))}
              </select>
            )}
            {current?.detail.is_stale && (
              <Alert
                variant="warning"
                title={t("payroll.adjustments.preview.stale")}
                action={
                  <Button size="sm" variant="outline" render={<Link href={`/dashboard/payroll/runs/${current.detail.id}`} />} nativeButton={false}>
                    <FileText className="size-4" />
                    {t("payroll.adjustments.preview.openRun")}
                  </Button>
                }
              >
                {t("payroll.adjustments.preview.staleText")}
              </Alert>
            )}
            {html ? (
              // Sandboxed with no scripts: the report is plain HTML and only needs to be looked at.
              <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-border bg-muted/40">
                <iframe title={t("payroll.adjustments.preview.frameTitle")} srcDoc={html} sandbox="" className="h-full min-h-[60vh] w-full min-w-250 bg-white" />
              </div>
            ) : (
              <Skeleton className="min-h-0 flex-1" />
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
