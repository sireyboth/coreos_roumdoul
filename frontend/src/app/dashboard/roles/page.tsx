"use client";

import { useEffect, useState } from "react";
import { Plus, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ExcelActions } from "@/components/dashboard/excel/excel-actions";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { displayOrderColumn } from "@/components/dashboard/shared/display-order";
import { PageHeader } from "@/components/dashboard/layout/page-header";
import { RoleDialog } from "@/components/dashboard/access/role-dialog";
import { useMe } from "@/contexts/me-context";
import { api, PermissionGroup, Role } from "@/lib/api";
import { exportRoles, roleImport } from "@/lib/excel/specs/people";
import { notifyError, notifySuccess } from "@/lib/notify";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { useT } from "@/lib/i18n";

export default function RolesPage() {
  const { me, refresh } = useMe();
  const t = useT();
  const confirm = useConfirm();
  const [roles, setRoles] = useState<Role[] | null>(null);
  const [groups, setGroups] = useState<PermissionGroup[]>([]);
  // Which role the dialog is open for: null = a new one.
  const [dialog, setDialog] = useState<{ role: Role | null } | null>(null);

  function load() {
    api.roles.list().then(setRoles).catch(() => setRoles([]));
    api.roles.permissions().then(setGroups).catch(() => setGroups([]));
  }

  useEffect(() => {
    load();
  }, []);

  async function handleDelete(role: Role) {
    const ok = await confirm({
      title: t("access.rolesPage.deleteTitle", { name: role.name }),
      description: t("access.rolesPage.deleteDescription"),
      destructive: true,
    });
    if (!ok) return;
    try {
      await api.roles.remove(role.id);
      notifySuccess(t("access.rolesPage.deleted", { name: role.name }));
      load();
    } catch (err) {
      notifyError(err);
    }
  }

  const canManage = me?.permissions.includes("roles.manage") ?? false;
  const canManageCompany = me?.permissions.includes("company.manage") ?? false;
  const [savingSelfApproval, setSavingSelfApproval] = useState(false);

  async function setSelfApproval(allow: boolean) {
    setSavingSelfApproval(true);
    try {
      await api.companySettings.update({ allow_self_approval: allow });
      notifySuccess(allow ? t("access.rolesPage.selfOn") : t("access.rolesPage.selfOff"));
      refresh();
    } catch (err) {
      notifyError(err);
    } finally {
      setSavingSelfApproval(false);
    }
  }
  const totalPermissions = groups.reduce((n, g) => n + g.permissions.length, 0);

  const columns: DataTableColumn<Role>[] = [
    {
      id: "name",
      header: t("access.rolesPage.colRole"),
      primary: true,
      cell: (role) => (
        <div className="flex items-center gap-2 font-medium">
          {role.name}
          {role.protected && <Badge variant="secondary">{t("access.rolesPage.protected")}</Badge>}
        </div>
      ),
      sortValue: (role) => role.name,
      searchValue: (role) => role.name,
    },
    displayOrderColumn<Role>(),
    {
      id: "permissions",
      header: t("access.rolesPage.colPermissions"),
      cell: (role) => (
        <span className="text-muted-foreground">
          {t("access.rolesPage.permissionCount", { n: role.permissions.length, total: totalPermissions })}
        </span>
      ),
      sortValue: (role) => role.permissions.length,
    },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex w-full flex-col gap-6">
        <PageHeader
          title={t("access.rolesPage.title")}
          description={t("access.rolesPage.description")}
          action={
            <div className="flex flex-wrap gap-2">
              <ExcelActions onExport={exportRoles} importSpec={canManage ? roleImport : undefined} onImported={load} />
              {canManage && (
                <Button onClick={() => setDialog({ role: null })}>
                  <Plus className="size-4" />
                  {t("access.rolesPage.create")}
                </Button>
              )}
            </div>
          }
        />

        <DataTable
          data={roles}
          getRowId={(role) => role.id}
          columns={columns}
          searchPlaceholder={t("access.rolesPage.search")}
          emptyState={{ icon: ShieldCheck, title: t("access.rolesPage.empty"), description: t("access.rolesPage.emptyHint") }}
          rowActions={
            canManage
              ? (role) =>
                  role.protected ? (
                    <Button variant="outline" size="sm" onClick={() => setDialog({ role })}>
                      {t("access.rolesPage.editOrder")}
                    </Button>
                  ) : (
                    <>
                      <Button variant="outline" size="sm" onClick={() => setDialog({ role })}>
                        {t("common.action.edit")}
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleDelete(role)}>
                        {t("common.action.delete")}
                      </Button>
                    </>
                  )
              : undefined
          }
        />

        {canManageCompany && me?.company && (
          <Card>
            <CardHeader>
              <CardTitle>{t("access.rolesPage.selfTitle")}</CardTitle>
              <CardDescription>
                {t("access.rolesPage.selfDescription")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={me.company.allow_self_approval}
                  disabled={savingSelfApproval}
                  onChange={(e) => setSelfApproval(e.target.checked)}
                />
                {t("access.rolesPage.selfLabel")}
              </label>
            </CardContent>
          </Card>
        )}

        {dialog && (
          <RoleDialog
            key={dialog.role?.id ?? "new"}
            open
            role={dialog.role}
            groups={groups}
            onOpenChange={(open) => !open && setDialog(null)}
            onSaved={load}
          />
        )}
      </div>
    </div>
  );
}
