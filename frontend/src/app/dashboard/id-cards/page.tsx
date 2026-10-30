"use client";

import { useEffect, useState } from "react";
import { Eye, IdCard } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { CardPreviewDialog } from "@/components/dashboard/employees/card-preview-dialog";
import { EmployeeAvatar } from "@/components/dashboard/employees/employee-avatar";
import { IdCardView } from "@/components/dashboard/employees/id-card-view";
import { PageHeader } from "@/components/dashboard/layout/page-header";
import { surfaceCard } from "@/components/dashboard/shared/kbach";
import { useMe } from "@/contexts/me-context";
import { api, Employee } from "@/lib/api";
import { withBusy } from "@/lib/busy";
import { saveBlob } from "@/lib/export/download";
import { useT } from "@/lib/i18n";
import { notifyError } from "@/lib/notify";
import { cn } from "@/lib/utils";

/**
 * ID cards. People who manage employees browse everyone and view or print
 * any badge (the same PDF the employee's own page generates). Everyone else
 * just sees their own card here — no list, no printing (the API refuses
 * anyone else's card anyway).
 */
export default function IdCardsPage() {
  const { me } = useMe();
  const t = useT();
  const canView = me?.permissions.includes("employees.view") ?? false;
  const canManage = me?.permissions.includes("employees.manage") ?? false;

  if (!canView) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <Alert variant="destructive">{t("employees.shared.noPermission")}</Alert>
      </div>
    );
  }

  return canManage ? <AllCards /> : <OwnCard employeeId={me?.employee?.id ?? null} />;
}

/** Staff: their own card, shown as the card itself. */
function OwnCard({ employeeId }: { employeeId: number | null }) {
  const t = useT();

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <PageHeader title={t("employees.idCards.ownTitle")} description={t("employees.idCards.ownDescription")} />
        {employeeId ? (
          <section className={cn(surfaceCard, "p-4 sm:p-6")}>
            <IdCardView employeeId={employeeId} />
          </section>
        ) : (
          <Alert>{t("employees.idCards.noRecord")}</Alert>
        )}
      </div>
    </div>
  );
}

/** HR / managers: every employee, with View (preview) and Print (PDF). */
function AllCards() {
  const t = useT();
  const [employees, setEmployees] = useState<Employee[] | null>(null);
  // Which row is generating its PDF, so only that Print button shows "Preparing…".
  const [printing, setPrinting] = useState<number | null>(null);
  // The employee whose card is open in the preview modal.
  const [preview, setPreview] = useState<Employee | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    api.employees
      .list()
      .then((res) => setEmployees(res.data))
      .catch(() => setEmployees([]));
  }, []);

  async function handlePrint(employee: Employee) {
    setPrinting(employee.id);
    try {
      const blob = await withBusy(() => api.employees.card(employee.id));
      saveBlob(blob, `employee-card-${employee.employee_code ?? employee.id}.pdf`);
    } catch (err) {
      notifyError(err);
    } finally {
      setPrinting(null);
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
                  onClick={() => {
                    setPreview(employee);
                    setPreviewOpen(true);
                  }}
                >
                  <Eye className="size-3.5" />
                  {t("common.action.view")}
                </Button>
                <Button variant="outline" size="sm" onClick={() => handlePrint(employee)} disabled={printing === employee.id}>
                  <IdCard className="size-3.5" />
                  {printing === employee.id ? t("employees.shared.preparing") : t("common.action.print")}
                </Button>
              </>
            )}
          />
        )}
      </div>
      <CardPreviewDialog employee={preview} canDownload open={previewOpen} onOpenChange={setPreviewOpen} />
    </div>
  );
}
