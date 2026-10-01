"use client";

import { useRef, useState } from "react";
import { CheckCircle2, Download, FileSpreadsheet, RefreshCw, Upload, XCircle } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { downloadSheet, downloadTemplate, headerKey, readFirstSheet, today, WorkbookError } from "@/lib/excel";
import {
  errorText,
  isFatal,
  mapColumns,
  parseRows,
  templateColumns,
  type ImportSpec,
  type ParsedRow,
} from "@/lib/excel-import";
import { notifyError, notifySuccess } from "@/lib/notify";
import { cn } from "@/lib/utils";

// Each row is one request; past this a person is better served by splitting the file.
const MAX_ROWS = 1000;

type Failure = { rowNumber: number; cells: Record<string, string>; error: string };

type Stage =
  | { step: "upload" }
  | { step: "review"; fileName: string; rows: ParsedRow[]; ignored: string[] }
  | { step: "running"; total: number; done: number }
  | {
      step: "done";
      created: number;
      updated: number;
      skipped: number;
      failures: Failure[];
      // Set when the run stopped early (plan limit, lost connection…).
      stoppedBecause: string | null;
      notRun: number;
    };

/**
 * Upload → review → import → results, for any module. The module only
 * describes its columns and how to save one row (see ImportSpec).
 */
export function ExcelImportDialog<Ctx>({
  spec,
  open,
  onOpenChange,
  onImported,
}: {
  spec: ImportSpec<Ctx>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => void;
}) {
  const [stage, setStage] = useState<Stage>({ step: "upload" });
  const [settings, setSettings] = useState<Record<string, boolean>>(() =>
    Object.fromEntries((spec.settings ?? []).map((s) => [s.key, s.default])),
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const stopRequested = useRef(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const running = stage.step === "running";
  const { one, many } = spec.noun;

  function reset() {
    setStage({ step: "upload" });
    setError(null);
  }

  function handleOpenChange(next: boolean) {
    // Closing mid-run would leave half a file imported with nothing on screen to say so.
    if (running) return;
    onOpenChange(next);
    if (!next) {
      if (stage.step === "done") onImported();
      // Reset after the closing animation, so the content doesn't jump while it fades.
      setTimeout(reset, 200);
    }
  }

  async function handleTemplate() {
    setBusy(true);
    try {
      const ctx = await spec.load();
      await downloadTemplate(
        `${spec.templateFile}-import-template.xlsx`,
        capitalise(many),
        templateColumns(spec.fields, spec.choices?.(ctx)),
        [spec.matching, ...(typeof spec.notes === "function" ? spec.notes(ctx) : (spec.notes ?? []))],
      );
    } catch (err) {
      notifyError(err);
    } finally {
      setBusy(false);
    }
  }

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    setBusy(true);

    try {
      const { headers, rows } = await readFirstSheet(file);
      const columns = mapColumns(spec.fields, headers);

      const missing = spec.fields.filter((f) => f.required && !columns[f.key]).map((f) => `"${f.header}"`);
      if (missing.length > 0) {
        throw new WorkbookError(
          `The file has no ${missing.join(", ")} column${missing.length === 1 ? "" : "s"}. Start from the template so the headers match.`,
        );
      }
      if (rows.length === 0) throw new WorkbookError(`The file has a header row but no ${many} under it.`);
      if (rows.length > MAX_ROWS) {
        throw new WorkbookError(`The file has ${rows.length.toLocaleString()} rows. Import at most ${MAX_ROWS.toLocaleString()} at a time — split it into smaller files.`);
      }

      const used = new Set(Object.values(columns));
      const ignored = headers.filter((h) => headerKey(h) && !used.has(headerKey(h)));

      setStage({ step: "review", fileName: file.name, rows: parseRows(spec.fields, columns, rows), ignored });
    } catch (err) {
      setError(err instanceof WorkbookError ? err.message : "That file couldn't be read.");
    } finally {
      setBusy(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function handleImport() {
    if (stage.step !== "review") return;

    const ready = stage.rows.filter((r) => r.problems.length === 0);
    const failures: Failure[] = stage.rows
      .filter((r) => r.problems.length > 0)
      .map((r) => ({ rowNumber: r.rowNumber, cells: r.cells, error: r.problems.join(" ") }));
    const counts = { created: 0, updated: 0, skipped: 0 };
    let stoppedBecause: string | null = null;
    let notRun = 0;

    stopRequested.current = false;
    setStage({ step: "running", total: ready.length, done: 0 });

    let ctx: Ctx;
    try {
      // Fresh lookups for every run, so names created since the dialog opened are known.
      ctx = await spec.load();
    } catch (err) {
      notifyError(err);
      setStage(stage);
      return;
    }

    for (let i = 0; i < ready.length; i++) {
      if (stopRequested.current) {
        stoppedBecause = "You stopped the import.";
        notRun = ready.length - i;
        break;
      }

      const row = ready[i];
      try {
        counts[await spec.save(row.row, ctx, settings)]++;
      } catch (err) {
        failures.push({ rowNumber: row.rowNumber, cells: row.cells, error: errorText(err) });
        if (isFatal(err)) {
          stoppedBecause = errorText(err);
          notRun = ready.length - i - 1;
          break;
        }
      }
      setStage({ step: "running", total: ready.length, done: i + 1 });
    }

    failures.sort((a, b) => a.rowNumber - b.rowNumber);
    setStage({ step: "done", ...counts, failures, stoppedBecause, notRun });

    const saved = counts.created + counts.updated;
    if (saved > 0) {
      notifySuccess(
        `${saved.toLocaleString()} ${saved === 1 ? one : many} imported`,
        failures.length > 0 ? `${failures.length} row${failures.length === 1 ? "" : "s"} need attention.` : undefined,
      );
    }
  }

  /** The rows that didn't make it, with the reason, ready to fix and upload again. */
  async function handleFailureReport(failures: Failure[]) {
    try {
      await downloadSheet(`${spec.templateFile}-import-errors-${today()}.xlsx`, {
        name: "Needs fixing",
        rows: failures,
        columns: [
          { header: "Excel row", value: (f) => f.rowNumber, type: "number" },
          { header: "Problem", value: (f) => f.error, width: 50 },
          ...spec.fields.map((field) => ({
            header: field.header,
            value: (f: Failure) => {
              const key = [field.header, ...(field.aliases ?? [])]
                .map(headerKey)
                .find((h) => h in f.cells);
              return key ? f.cells[key] : "";
            },
          })),
        ],
      });
    } catch (err) {
      notifyError(err);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl" showCloseButton={!running}>
        <DialogHeader>
          <DialogTitle>Import {many} from Excel</DialogTitle>
          <DialogDescription>
            Add {many} in bulk from a spreadsheet. Each row is checked exactly as if it were entered by hand.
          </DialogDescription>
        </DialogHeader>

        {stage.step === "upload" && (
          <div className="flex flex-col gap-4">
            <ol className="grid gap-3 sm:grid-cols-3">
              {[
                { title: "Download the template", body: "Headers, dropdowns and instructions are ready." },
                { title: `Add your ${many}`, body: "One row each. Blue headers are required." },
                { title: "Upload it here", body: "Review the rows before anything is saved." },
              ].map((item, i) => (
                <li key={item.title} className="flex gap-3 rounded-lg border border-border bg-muted/30 p-3">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                    {i + 1}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">{item.title}</span>
                    <span className="block text-xs text-muted-foreground">{item.body}</span>
                  </span>
                </li>
              ))}
            </ol>

            <Button variant="outline" onClick={handleTemplate} disabled={busy} className="self-start">
              <Download className="size-4" />
              Download template
            </Button>

            <label
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                handleFile(e.dataTransfer.files[0]);
              }}
              className={cn(
                "flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed px-6 py-8 text-center transition-colors",
                dragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/40",
                busy && "pointer-events-none opacity-60",
              )}
            >
              <span className="flex size-11 items-center justify-center rounded-xl bg-success/12 text-success">
                <FileSpreadsheet className="size-5" />
              </span>
              <span className="text-sm font-medium">{busy ? "Reading file…" : "Drop your Excel file here, or click to browse"}</span>
              <span className="text-xs text-muted-foreground">Excel workbook (.xlsx), up to {MAX_ROWS.toLocaleString()} rows</span>
              <input
                ref={fileInput}
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="sr-only"
                onChange={(e) => handleFile(e.target.files?.[0])}
              />
            </label>

            {error && <Alert variant="destructive">{error}</Alert>}
            <Alert variant="info">{spec.matching} Blank cells on an existing record leave that detail unchanged.</Alert>
          </div>
        )}

        {stage.step === "review" && (
          <ReviewStep
            spec={spec}
            stage={stage}
            settings={settings}
            onSettingChange={(key, value) => setSettings((s) => ({ ...s, [key]: value }))}
            onChangeFile={reset}
            onImport={handleImport}
            onCancel={() => handleOpenChange(false)}
          />
        )}

        {stage.step === "running" && (
          <div className="flex flex-col gap-4 py-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">
                Importing {many}… {stage.done.toLocaleString()} of {stage.total.toLocaleString()}
              </span>
              <span className="text-muted-foreground">{stage.total ? Math.round((stage.done / stage.total) * 100) : 0}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuemin={0} aria-valuemax={stage.total} aria-valuenow={stage.done}>
              <div className="h-full rounded-full bg-primary transition-[width] duration-300" style={{ width: `${stage.total ? (stage.done / stage.total) * 100 : 0}%` }} />
            </div>
            <p className="text-xs text-muted-foreground">Keep this window open until it finishes.</p>
            <DialogFooter>
              <Button variant="outline" onClick={() => (stopRequested.current = true)}>
                Stop after this row
              </Button>
            </DialogFooter>
          </div>
        )}

        {stage.step === "done" && (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Added" value={stage.created} tone="success" />
              <Stat label="Updated" value={stage.updated} tone="info" />
              <Stat label="Unchanged" value={stage.skipped} tone="muted" />
              <Stat label="Failed" value={stage.failures.length} tone={stage.failures.length ? "destructive" : "muted"} />
            </div>

            {stage.stoppedBecause && (
              <Alert variant="warning" title="The import stopped early">
                {stage.stoppedBecause}
                {stage.notRun > 0 && ` ${stage.notRun.toLocaleString()} row${stage.notRun === 1 ? " was" : "s were"} not attempted.`}
              </Alert>
            )}

            {stage.failures.length > 0 ? (
              <>
                <ProblemList items={stage.failures.map((f) => ({ rowNumber: f.rowNumber, text: f.error }))} />
                <Button variant="outline" className="self-start" onClick={() => handleFailureReport(stage.failures)}>
                  <Download className="size-4" />
                  Download rows that need fixing
                </Button>
              </>
            ) : (
              !stage.stoppedBecause && (
                <Alert variant="success">Every row was imported.</Alert>
              )
            )}

            <DialogFooter>
              <Button variant="outline" onClick={reset}>
                <RefreshCw className="size-4" />
                Import another file
              </Button>
              <Button onClick={() => handleOpenChange(false)}>Done</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ReviewStep<Ctx>({
  spec,
  stage,
  settings,
  onSettingChange,
  onChangeFile,
  onImport,
  onCancel,
}: {
  spec: ImportSpec<Ctx>;
  stage: Extract<Stage, { step: "review" }>;
  settings: Record<string, boolean>;
  onSettingChange: (key: string, value: boolean) => void;
  onChangeFile: () => void;
  onImport: () => void;
  onCancel: () => void;
}) {
  const ready = stage.rows.filter((r) => r.problems.length === 0);
  const invalid = stage.rows.filter((r) => r.problems.length > 0);
  // The first few columns are enough to recognise a row.
  const previewFields = spec.fields.slice(0, 4);
  const { one, many } = spec.noun;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2.5">
        <FileSpreadsheet className="size-5 shrink-0 text-success" />
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{stage.fileName}</span>
        <Button variant="ghost" size="sm" onClick={onChangeFile}>
          <Upload className="size-3.5" />
          Choose another file
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Rows found" value={stage.rows.length} tone="muted" />
        <Stat label="Ready" value={ready.length} tone="success" />
        <Stat label="Need fixing" value={invalid.length} tone={invalid.length ? "destructive" : "muted"} />
      </div>

      {invalid.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-muted-foreground">
            These rows will be skipped. Fix them in the file and upload it again, or import the rest now.
          </p>
          <ProblemList items={invalid.map((r) => ({ rowNumber: r.rowNumber, text: r.problems.join(" ") }))} />
        </div>
      )}

      {stage.ignored.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Not imported (not a column this page uses): {stage.ignored.join(", ")}.
        </p>
      )}

      {ready.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-border">
          <div className="max-h-56 overflow-auto">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-muted text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Row</th>
                  {previewFields.map((f) => (
                    <th key={f.key} className="px-3 py-2 font-medium whitespace-nowrap">
                      {f.header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {ready.slice(0, 100).map((r) => (
                  <tr key={r.rowNumber}>
                    <td className="px-3 py-1.5 text-muted-foreground tabular-nums">{r.rowNumber}</td>
                    {previewFields.map((f) => (
                      <td key={f.key} className="max-w-48 truncate px-3 py-1.5">
                        {r.row.text(f.key) === undefined
                          ? <span className="text-muted-foreground">—</span>
                          : f.options?.find((o) => o.value === r.row.text(f.key))?.label ?? displayValue(r.row.text(f.key)!)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {ready.length > 100 && (
            <p className="border-t border-border bg-muted/30 px-3 py-1.5 text-xs text-muted-foreground">
              Showing the first 100 of {ready.length.toLocaleString()} rows.
            </p>
          )}
        </div>
      )}

      {(spec.settings ?? []).map((setting) => (
        <label key={setting.key} className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-border p-3 text-sm">
          <input
            type="checkbox"
            checked={settings[setting.key] ?? false}
            onChange={(e) => onSettingChange(setting.key, e.target.checked)}
            className="mt-0.5 size-4 rounded border-input"
          />
          <span>
            <span className="block font-medium">{setting.label}</span>
            {setting.description && <span className="block text-xs text-muted-foreground">{setting.description}</span>}
          </span>
        </label>
      ))}

      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={onImport} disabled={ready.length === 0}>
          <Upload className="size-4" />
          Import {ready.length.toLocaleString()} {ready.length === 1 ? one : many}
        </Button>
      </DialogFooter>
    </div>
  );
}

function displayValue(value: string): string {
  if (value === "true") return "Yes";
  if (value === "false") return "No";
  return value;
}

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function ProblemList({ items }: { items: { rowNumber: number; text: string }[] }) {
  return (
    <ul className="max-h-44 divide-y divide-border overflow-y-auto rounded-lg border border-destructive/25 bg-destructive/5 text-sm">
      {items.map((item, i) => (
        <li key={`${item.rowNumber}-${i}`} className="flex gap-3 px-3 py-2">
          <Badge variant="destructive" className="shrink-0 tabular-nums">
            Row {item.rowNumber}
          </Badge>
          <span className="min-w-0 text-foreground/90">{item.text}</span>
        </li>
      ))}
    </ul>
  );
}

const TONES = {
  success: "text-success",
  info: "text-info",
  destructive: "text-destructive",
  muted: "text-foreground",
} as const;

function Stat({ label, value, tone }: { label: string; value: number; tone: keyof typeof TONES }) {
  const Icon = tone === "success" ? CheckCircle2 : tone === "destructive" ? XCircle : null;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {Icon && <Icon className={cn("size-3.5", TONES[tone])} />}
        {label}
      </div>
      <div className={cn("mt-0.5 text-xl font-semibold tabular-nums", TONES[tone])}>{value.toLocaleString()}</div>
    </div>
  );
}
