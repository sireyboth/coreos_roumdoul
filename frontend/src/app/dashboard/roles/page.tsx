"use client";

import { useEffect, useState } from "react";
import { Plus, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ExcelActions } from "@/components/dashboard/excel-actions";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { DisplayOrderField, displayOrderColumn, fromSortOrder, toSortOrder } from "@/components/dashboard/display-order";
import { PageHeader } from "@/components/dashboard/page-header";
import { useMe } from "@/contexts/me-context";
import { api, ApiError, PermissionGroup, Role } from "@/lib/api";
import { Alert } from "@/components/ui/alert";
import { exportRoles, roleImport } from "@/lib/excel-specs/people";
import { notifyError, notifySuccess } from "@/lib/notify";
import { useConfirm } from "@/components/ui/confirm-dialog";

function permissionLabel(permission: string): string {
  const action = permission.split(".")[1];
  return action === "view" ? "View" : "Manage";
}

function resourceLabel(resource: string): string {
  return resource.charAt(0).toUpperCase() + resource.slice(1).replace("_", " ");
}

function PermissionCheckboxes({
  groups,
  selected,
  onChange,
}: {
  groups: PermissionGroup[];
  selected: string[];
  onChange: (permissions: string[]) => void;
}) {
  function toggle(permission: string) {
    onChange(
      selected.includes(permission)
        ? selected.filter((p) => p !== permission)
        : [...selected, permission],
    );
  }

  return (
    <div className="grid max-h-80 grid-cols-2 gap-3 overflow-y-auto pr-1">
      {groups.map((group) => (
        <div key={group.resource} className="rounded-md border border-border p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {resourceLabel(group.resource)}
          </p>
          <div className="flex flex-col gap-1.5">
            {group.permissions.map((permission) => (
              <label key={permission} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={selected.includes(permission)}
                  onChange={() => toggle(permission)}
                  className="size-4 rounded border-input"
                />
                {permissionLabel(permission)}
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function RolesPage() {
  const { me } = useMe();
  const confirm = useConfirm();
  const [roles, setRoles] = useState<Role[] | null>(null);
  const [groups, setGroups] = useState<PermissionGroup[]>([]);

  const [createOpen, setCreateOpen] = useState(false);
  const [newRoleName, setNewRoleName] = useState("");
  const [newRolePermissions, setNewRolePermissions] = useState<string[]>([]);
  const [newRoleOrder, setNewRoleOrder] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [editName, setEditName] = useState("");
  const [editPermissions, setEditPermissions] = useState<string[]>([]);
  const [editOrder, setEditOrder] = useState("");
  const [editError, setEditError] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  function load() {
    api.roles.list().then(setRoles).catch(() => setRoles([]));
    api.roles.permissions().then(setGroups).catch(() => setGroups([]));
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreateError(null);
    setCreating(true);

    try {
      await api.roles.create({ name: newRoleName, permissions: newRolePermissions, sort_order: toSortOrder(newRoleOrder) });
      notifySuccess("Role created");
      setNewRoleName("");
      setNewRolePermissions([]);
      setNewRoleOrder("");
      setCreateOpen(false);
      load();
    } catch (err) {
      notifyError(err);
      setCreateError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setCreating(false);
    }
  }

  function openEdit(role: Role) {
    setEditingRole(role);
    setEditName(role.name);
    setEditPermissions(role.permissions);
    setEditOrder(fromSortOrder(role.sort_order));
    setEditError(null);
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingRole) return;
    setEditError(null);
    setSavingEdit(true);

    try {
      const sortOrder = toSortOrder(editOrder);
      const name = editName.trim();
      // The built-in admin role keeps its permissions; its name can change like any other.
      await api.roles.update(editingRole.id, {
        ...(name && name !== editingRole.name ? { name } : {}),
        ...(editingRole.protected ? {} : { permissions: editPermissions }),
        sort_order: sortOrder,
      });
      notifySuccess("Role updated");
      setEditingRole(null);
      load();
    } catch (err) {
      notifyError(err);
      setEditError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setSavingEdit(false);
    }
  }

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
                <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                  <DialogTrigger
                    render={
                      <Button>
                        <Plus className="size-4" />
                        Create role
                      </Button>
                    }
                  />
                  <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                      <DialogTitle>Create a role</DialogTitle>
                      <DialogDescription>E.g. &quot;HR Officer&quot; or &quot;Supervisor&quot;.</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleCreate} className="flex flex-col gap-4">
                      <div className="flex flex-col gap-2">
                        <Label htmlFor="role_name">Role name</Label>
                        <Input
                          id="role_name"
                          required
                          value={newRoleName}
                          onChange={(e) => setNewRoleName(e.target.value)}
                        />
                      </div>
                      <div className="flex flex-col gap-2">
                        <Label>Permissions</Label>
                        <PermissionCheckboxes
                          groups={groups}
                          selected={newRolePermissions}
                          onChange={setNewRolePermissions}
                        />
                      </div>
                      <DisplayOrderField id="role-order" value={newRoleOrder} onChange={setNewRoleOrder} example="the most senior role" />
                      {createError && <Alert variant="destructive">{createError}</Alert>}
                      <DialogFooter>
                        <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
                        <Button type="submit" disabled={creating}>
                          {creating ? "Creating…" : "Create role"}
                        </Button>
                      </DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>
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
                    <Button variant="outline" size="sm" onClick={() => openEdit(role)}>
                      Edit order
                    </Button>
                  ) : (
                    <>
                      <Button variant="outline" size="sm" onClick={() => openEdit(role)}>
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

        <Dialog open={!!editingRole} onOpenChange={(open) => !open && setEditingRole(null)}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Edit &quot;{editingRole?.name}&quot;</DialogTitle>
              <DialogDescription>
                {editingRole?.protected
                  ? "This role's permissions are fixed. You can rename it and change where it appears in lists."
                  : "Changes apply immediately to everyone with this role."}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSaveEdit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="role_edit_name">Role name</Label>
                <Input id="role_edit_name" required maxLength={255} value={editName} onChange={(e) => setEditName(e.target.value)} />
                <p className="text-xs text-muted-foreground">Only the name changes — everyone with this role keeps it.</p>
              </div>
              {!editingRole?.protected && <PermissionCheckboxes groups={groups} selected={editPermissions} onChange={setEditPermissions} />}
              <DisplayOrderField id="role-edit-order" value={editOrder} onChange={setEditOrder} example="the most senior role" />
              {editError && <Alert variant="destructive">{editError}</Alert>}
              <DialogFooter>
                <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
                <Button type="submit" disabled={savingEdit}>
                  {savingEdit ? "Saving…" : "Save changes"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
