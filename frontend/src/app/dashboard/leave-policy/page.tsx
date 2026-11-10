"use client";

import { useEffect, useState } from "react";
import { AlarmClock, Plane, Plus, Scale } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/dashboard/layout/page-header";
import { PillTabs, type PillTab } from "@/components/dashboard/shared/pill-tabs";
import { LateEarlySettingsCard } from "@/components/dashboard/requests/late-early-settings";
import { LeaveBalanceAdjuster } from "@/components/dashboard/requests/leave-balance-adjuster";
import { LeaveTypeCardGrid, leaveRules } from "@/components/dashboard/requests/leave-type-card-grid";
import { LeaveTypeDialog } from "@/components/dashboard/requests/leave-type-dialog";
import { api, type LeaveType } from "@/lib/api";
import { useLang, useT } from "@/lib/i18n";
import { notifyError } from "@/lib/notify";

type Tab = "types" | "lateEarly" | "balances";

/**
 * Leave policy, one tab per job: the kinds of leave (as cards), the late
 * arrival / early leave rules, and adjusting one person's balance.
 */
export default function LeavePolicyPage() {
  const t = useT();
  const lang = useLang();
  const [types, setTypes] = useState<LeaveType[] | null>(null);
  const [reloads, setReloads] = useState(0);
  const [editing, setEditing] = useState<{ type: LeaveType | null } | null>(null);
  const [tab, setTab] = useState<Tab>("types");

  useEffect(() => {
    api.leave.types(true).then(setTypes).catch((err) => {
      notifyError(err);
      setTypes([]);
    });
  }, [reloads]);

  const tabs: PillTab<Tab>[] = [
    { id: "types", label: t("leave.policyPage.tabs.types"), icon: Plane },
    { id: "lateEarly", label: t("leave.shared.lateEarly"), icon: AlarmClock },
    { id: "balances", label: t("leave.policyPage.tabs.balances"), icon: Scale },
  ];

  // The page draws cards (renderRows below); these columns still drive the table's search and sort menu.
  const columns: DataTableColumn<LeaveType>[] = [
    {
      id: "name",
      header: t("leave.policyPage.colLeave"),
      primary: true,
      cell: (lt) => lt.name,
      sortValue: (lt) => lt.sort_order ?? 9999,
      searchValue: (lt) => [lt.name, lt.name_km, lt.code, ...leaveRules(lt, lang)].filter(Boolean).join(" "),
    },
    { id: "pay", header: t("leave.policyPage.colPay"), cell: (lt) => `${lt.pay_percent}%`, sortValue: (lt) => lt.pay_percent },
    { id: "active", header: t("common.field.status"), cell: (lt) => (lt.is_active ? t("common.status.active") : t("leave.policyPage.off")), sortValue: (lt) => (lt.is_active ? 0 : 1) },
  ];

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <PageHeader
        title={t("leave.policyPage.title")}
        description={t("leave.policyPage.description")}
        action={
          tab === "types" && (
            <Button onClick={() => setEditing({ type: null })}>
              <Plus className="size-4" />
              {t("leave.policyPage.addType")}
            </Button>
          )
        }
      />

      <PillTabs tabs={tabs} value={tab} onChange={setTab} />

      {tab === "types" && (
        <>
          <Alert variant="info" title={t("leave.policyPage.lawTitle")}>
            {t("leave.policyPage.lawBody")}
          </Alert>
          <DataTable
            data={types}
            getRowId={(lt) => lt.id}
            columns={columns}
            searchPlaceholder={t("leave.policyPage.search")}
            emptyState={{ icon: Plane, title: t("leave.policyPage.empty"), description: t("leave.policyPage.emptyHint") }}
            defaultPageSize={12}
            pageSizeOptions={[12, 24, 48]}
            renderRows={(rows) => <LeaveTypeCardGrid types={rows} onEdit={(type) => setEditing({ type })} />}
          />
        </>
      )}

      {tab === "lateEarly" && <LateEarlySettingsCard />}

      {tab === "balances" && (types ? <LeaveBalanceAdjuster types={types} /> : <Skeleton className="h-64 w-full rounded-xl" />)}

      {editing && (
        <LeaveTypeDialog
          key={editing.type?.id ?? "new"}
          type={editing.type}
          open
          onOpenChange={(o) => !o && setEditing(null)}
          onSaved={() => setReloads((n) => n + 1)}
        />
      )}
    </div>
  );
}
