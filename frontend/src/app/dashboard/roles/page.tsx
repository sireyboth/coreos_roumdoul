"use client";

import { useEffect, useState } from "react";
import { Plus, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ExcelActions } from "@/components/dashboard/excel-actions";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { displayOrderColumn } from "@/components/dashboard/display-order";
import { PageHeader } from "@/components/dashboard/page-header";
import { RoleDialog } from "@/components/dashboard/role-dialog";
import { useMe } from "@/contexts/me-context";
import { api, PermissionGroup, Role } from "@/lib/api";
import { exportRoles, roleImport } from "@/lib/excel-specs/people";
import { notifyError, notifySuccess } from "@/lib/notify";
import { useConfirm } from "@/components/ui/confirm-dialog";

export default function RolesPage() {
  const { me, refresh } = useMe();
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
      title: `Delete the "${role.name}" role?`,
      description: "This can't be undone. A role that's still assigned to someone can't be deleted.",
      destructive: true,
    });
    if (!ok) return;
    try {
      await api.roles.remove(role.id);
      notifySuccess(`"${role.name}" role deleted`);
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
      notifySuccess(allow ? "People can now approve their own items" : "Self-approval is now blocked");
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
      header: "Role",
      primary: true,
      cell: (role) => (
        <div className="flex items-center gap-2 font-medium">
          {role.name}
          {role.protected && <Badge variant="secondary">Protected</Badge>}
        </div>
      ),
      sortValue: (role) => role.name,
      searchValue: (role) => role.name,
    },
    displayOrderColumn<Role>(),
    {
      id: "permissions",
      header: "Permissions",
      cell: (role) => (
        <span className="text-muted-foreground">
          {role.permissions.length} of {totalPermissions}
        </span>
      ),
      sortValue: (role) => role.permissions.length,
    },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex w-full flex-col gap-6">
        <PageHeader
          title="Roles & Permissions"
          description="Define what each position at your company can see and do."
          action={
            <div className="flex flex-wrap gap-2">
              <ExcelActions onExport={exportRoles} importSpec={canManage ? roleImport : undefined} onImported={load} />
              {canManage && (
                <Button onClick={() => setDialog({ role: null })}>
                  <Plus className="size-4" />
                  Create role
                </Button>
              )}
            </div>
          }
        />

        <DataTable
          data={roles}
          getRowId={(role) => role.id}
          columns={columns}
          searchPlaceholder="Search roles…"
          emptyState={{ icon: ShieldCheck, title: "No roles yet", description: "Create a role to control what your team can access." }}
          rowActions={
            canManage
              ? (role) =>
                  role.protected ? (
                    <Button variant="outline" size="sm" onClick={() => setDialog({ role })}>
                      Edit order
                    </Button>
                  ) : (
                    <>
                      <Button variant="outline" size="sm" onClick={() => setDialog({ role })}>
                        Edit
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleDelete(role)}>
                        Delete
                      </Button>
                    </>
                  )
              : undefined
          }
        />

        {canManageCompany && me?.company && (
          <Card>
            <CardHeader>
              <CardTitle>Self-approval</CardTitle>
              <CardDescription>
                By default nobody approves or changes their own attendance, overtime, leave balance or pay, or approves a
                pay run they prepared — someone else with the permission has to. Turn this on only if one person runs
                everything.
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
                Allow people to approve their own items
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
