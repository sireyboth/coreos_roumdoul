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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/dashboard/empty-state";
import { PageHeader } from "@/components/dashboard/page-header";
import { useMe } from "@/contexts/me-context";
import { api, ApiError, PermissionGroup, Role } from "@/lib/api";

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
  const [roles, setRoles] = useState<Role[] | null>(null);
  const [groups, setGroups] = useState<PermissionGroup[]>([]);

  const [createOpen, setCreateOpen] = useState(false);
  const [newRoleName, setNewRoleName] = useState("");
  const [newRolePermissions, setNewRolePermissions] = useState<string[]>([]);
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [editPermissions, setEditPermissions] = useState<string[]>([]);
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
      await api.roles.create({ name: newRoleName, permissions: newRolePermissions });
      setNewRoleName("");
      setNewRolePermissions([]);
      setCreateOpen(false);
      load();
    } catch (err) {
      setCreateError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setCreating(false);
    }
  }

  function openEdit(role: Role) {
    setEditingRole(role);
    setEditPermissions(role.permissions);
    setEditError(null);
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingRole) return;
    setEditError(null);
    setSavingEdit(true);

    try {
      await api.roles.update(editingRole.id, { permissions: editPermissions });
      setEditingRole(null);
      load();
    } catch (err) {
      setEditError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleDelete(role: Role) {
    if (!confirm(`Delete the "${role.name}" role?`)) return;
    try {
      await api.roles.remove(role.id);
      load();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Something went wrong.");
    }
  }

  const canManage = me?.permissions.includes("roles.manage") ?? false;

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex w-full flex-col gap-6">
        <PageHeader
          title="Roles & Permissions"
          description="Define what each position at your company can see and do."
          action={
            canManage && (
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
                    {createError && <p className="text-sm text-destructive">{createError}</p>}
                    <DialogFooter>
                      <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
                      <Button type="submit" disabled={creating}>
                        {creating ? "Creating…" : "Create role"}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            )
          }
        />

        {roles === null && <p className="text-sm text-muted-foreground">Loading…</p>}

        {roles?.length === 0 && (
          <EmptyState
            icon={ShieldCheck}
            title="No roles yet"
            description="Create a role to control what your team can access."
          />
        )}

        {roles && roles.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Role</TableHead>
                <TableHead>Permissions</TableHead>
                {canManage && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {roles.map((role) => (
                <TableRow key={role.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {role.name}
                      {role.protected && <Badge variant="secondary">Protected</Badge>}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {role.permissions.length} of {groups.reduce((n, g) => n + g.permissions.length, 0)}
                  </TableCell>
                  {canManage && (
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {!role.protected && (
                          <>
                            <Button variant="outline" size="sm" onClick={() => openEdit(role)}>
                              Edit permissions
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => handleDelete(role)}>
                              Delete
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        <Dialog open={!!editingRole} onOpenChange={(open) => !open && setEditingRole(null)}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Edit &quot;{editingRole?.name}&quot; permissions</DialogTitle>
              <DialogDescription>Changes apply immediately to everyone with this role.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSaveEdit} className="flex flex-col gap-4">
              <PermissionCheckboxes groups={groups} selected={editPermissions} onChange={setEditPermissions} />
              {editError && <p className="text-sm text-destructive">{editError}</p>}
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
