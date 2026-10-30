"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { IdCardView } from "@/components/dashboard/employees/id-card-view";
import { api } from "@/lib/api";
import { saveBlob } from "@/lib/export/download";
import { notifyError } from "@/lib/notify";
import { useT } from "@/lib/i18n";

/**
 * Shows an employee's ID card in-place, as the card itself (IdCardView), not
 * a PDF viewer. "Download" fetches the printable PDF only when clicked, and
 * only shows for people who print cards (canDownload).
 */
export function CardPreviewDialog({
  employee,
  canDownload,
  open,
  onOpenChange,
}: {
  employee: { id: number; employee_code?: string | null } | null;
  canDownload: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useT();
  const [downloading, setDownloading] = useState(false);

  async function download() {
    if (!employee) return;
    setDownloading(true);
    try {
      saveBlob(await api.employees.card(employee.id), `employee-card-${employee.employee_code ?? employee.id}.pdf`);
    } catch (err) {
      notifyError(err);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{t("employees.idCards.preview")}</DialogTitle>
        </DialogHeader>
        <div className="max-h-[75vh] overflow-y-auto">{employee && open && <IdCardView employeeId={employee.id} />}</div>
        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>{t("common.action.close")}</DialogClose>
          {canDownload && (
            <Button type="button" onClick={download} disabled={!employee || downloading}>
              <Download className="size-4" />
              {downloading ? t("employees.shared.preparing") : t("common.action.download")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
