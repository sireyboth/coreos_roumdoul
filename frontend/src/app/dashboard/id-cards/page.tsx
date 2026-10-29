"use client";

import { useEffect, useState } from "react";
import { Eye, IdCard } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { CardPreviewDialog } from "@/components/dashboard/employees/card-preview-dialog";
import { EmployeeAvatar } from "@/components/dashboard/employees/employee-avatar";
import { PageHeader } from "@/components/dashboard/layout/page-header";
import { useMe } from "@/contexts/me-context";
import { api, Employee } from "@/lib/api";
import { withBusy } from "@/lib/busy";
import { saveBlob } from "@/lib/export/download";
import { useT } from "@/lib/i18n";
import { notifyError } from "@/lib/notify";

/**
 * Browse employees and view/print a badge for any of them — the same PDF the
 * employee's own page generates (GET /api/employees/{id}/card), just listed
 * here for whoever wants several without opening each employee individually.
 */
export default function IdCardsPage() {
  const { me } = useMe();
  const t = useT();
  const canView = me?.permissions.includes("employees.view") ?? false;

  const [employees, setEmployees] = useState<Employee[] | null>(null);
  // Tracks which row + action is currently generating, so only that one
  // button shows "Preparing…" instead of freezing the whole table.
  const [busy, setBusy] = useState<{ id: number; action: "view" | "download" } | null>(null);
  // The employee whose card is open in the preview modal — kept alongside
  // the blob so the modal's own Download button knows the right filename.
  const [preview, setPreview] = useState<{ employee: Employee; blob: Blob } | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    if (!canView) return;
    api.employees
      .list()
      .then((res) => setEmployees(res.data))
      .catch(() => setEmployees([]));
  }, [canView]);

  async function handleCard(employee: Employee, action: "view" | "download") {
    setBusy({ id: employee.id, action });
    try {
      const blob = await withBusy(() => api.employees.card(employee.id));
      if (action === "view") {
        setPreview({ employee, blob });
        setPreviewOpen(true);
      } else {
        saveBlob(blob, `employee-card-${employee.employee_code ?? employee.id}.pdf`);
      }
    } catch (err) {
      notifyError(err);
    } finally {
      setBusy(null);
    }
  }

  const columns: DataTableColumn<Employee>[] = [
    {
      id: "name",
      header: t("common.field.name"),
      primary: true,
      cell: (employee) => (
        <div className="flex items-center gap-3">
          <EmployeeAvatar name={employee.name} photoUrl={employee.photo_url} />
          <div className="flex flex-col leading-tight">
            <span className="font-medium">{employee.name}</span>
            {employee.employee_code && <span className="text-xs text-muted-foreground">{employee.employee_code}</span>}
          </div>
        </div>
      ),
      sortValue: (employee) => employee.name,
      searchValue: (employee) => [employee.name, employee.employee_code].filter(Boolean).join(" "),
    },
    {
      id: "department",
      header: t("common.field.department"),
      cell: (employee) => <span className="text-muted-foreground">{employee.department?.name ?? "—"}</span>,
      sortValue: (employee) => employee.department?.name,
    },
    {
      id: "branch",
      header: t("common.field.branch"),
      cell: (employee) => <span className="text-muted-foreground">{employee.branch?.name ?? "—"}</span>,
      sortValue: (employee) => employee.branch?.name,
    },
  ];

  if (!canView) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <Alert variant="destructive">{t("employees.shared.noPermission")}</Alert>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex w-full flex-col gap-6">
        <PageHeader title={t("employees.idCards.title")} description={t("employees.idCards.description")} />

        {employees === null ? (
          <p className="text-sm text-muted-foreground">{t("common.message.loading")}</p>
        ) : (
          <DataTable
            data={employees}
            getRowId={(employee) => employee.id}
            columns={columns}
            searchPlaceholder={t("employees.idCards.search")}
            emptyState={{
              icon: IdCard,
              title: t("employees.shared.noEmployees"),
              description: t("employees.idCards.emptyHint"),
            }}
            rowActions={(employee) => (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCard(employee, "view")}
                  disabled={busy?.id === employee.id}
                >
                  <Eye className="size-3.5" />
                  {busy?.id === employee.id && busy.action === "view" ? t("employees.shared.preparing") : t("common.action.view")}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCard(employee, "download")}
                  disabled={busy?.id === employee.id}
                >
                  <IdCard className="size-3.5" />
                  {busy?.id === employee.id && busy.action === "download" ? t("employees.shared.preparing") : t("common.action.print")}
                </Button>
              </>
            )}
          />
        )}
      </div>
      <CardPreviewDialog
        blob={preview?.blob ?? null}
        filename={`employee-card-${preview?.employee.employee_code ?? preview?.employee.id}.pdf`}
        open={previewOpen}
        onOpenChange={setPreviewOpen}
      />
    </div>
  );
}
