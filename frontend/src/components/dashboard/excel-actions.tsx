"use client";

import { useState } from "react";
import { FileDown, FileUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ExcelImportDialog } from "@/components/dashboard/excel-import-dialog";
import type { ImportSpec } from "@/lib/excel-import";
import { notifyError, notifySuccess } from "@/lib/notify";

/**
 * The "Import" and "Export" buttons every module shows in its header.
 *
 * - `onExport` builds and downloads the workbook, and returns its file name.
 * - `importSpec` is left out for people who can only view the module, which
 *   hides the Import button (the server would refuse the rows anyway).
 */
export function ExcelActions<Ctx>({
  onExport,
  importSpec,
  onImported,
  subject,
}: {
  onExport?: () => Promise<string>;
  importSpec?: ImportSpec<Ctx>;
  onImported?: () => void;
  /** Names what the buttons are for when a page has more than one set, e.g. "assignments". */
  subject?: string;
}) {
  const [exporting, setExporting] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  async function handleExport() {
    if (!onExport) return;
    setExporting(true);
    try {
      const filename = await onExport();
      notifySuccess("Excel file downloaded", filename);
    } catch (err) {
      notifyError(err);
    } finally {
      setExporting(false);
    }
  }

  return (
    <>
      {importSpec && (
        <Button variant="outline" onClick={() => setImportOpen(true)}>
          <FileUp className="size-4" />
          {subject ? `Import ${subject}` : "Import"}
        </Button>
      )}
      {onExport && (
        <Button variant="outline" onClick={handleExport} disabled={exporting}>
          <FileDown className="size-4" />
          {exporting ? "Exporting…" : subject ? `Export ${subject}` : "Export"}
        </Button>
      )}
      {importSpec && (
        <ExcelImportDialog spec={importSpec} open={importOpen} onOpenChange={setImportOpen} onImported={() => onImported?.()} />
      )}
    </>
  );
}
