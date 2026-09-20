"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { KeyRound, Plus } from "lucide-react";
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
import { api, ApiError, Branch, CompanyUser, Role } from "@/lib/api";
import { Alert } from "@/components/ui/alert";
import { notifyError, notifySuccess } from "@/lib/notify";
import { useConfirm } from "@/components/ui/confirm-dialog";

function BranchAccessDialog({
  user,
  branches,
  open,
  onOpenChange,
  onSaved,
}: {
  user: CompanyUser | null;
  branches: Branch[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [selected, setSelected] = useState<number[]>(() => user?.branch_ids ?? []);
  const [saving, setSaving] = useState(false);

  function toggle(branchId: number) {
    setSelected((current) =>
      current.includes(branchId) ? current.filter((id) => id !== branchId) : [...current, branchId],
    );
  }

  async function handleSave() {
    if (!user) return;
    setSaving(true);
    try {
      await api.users.setBranchAccess(user.id, selected);
      notifySuccess("Branch access updated", `${user.name} can now see ${selected.length ? "only the selected branches" : "every branch"}.`);
      onOpenChange(false);
      onSaved();
    } catch (err) {
      notifyError(err);
      notifyError(err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Branch access for {user?.name}</DialogTitle>
          <DialogDescription>
            Leave everything unchecked to give them access to every branch. Check specific branches to
            restrict them to only those.
          </DialogDescription>
        </DialogHeader>
        <div className="flex max-h-72 flex-col gap-1.5 overflow-y-auto pr-1">
          {branches.map((branch) => (
            <label key={branch.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={selected.includes(branch.id)}
                onChange={() => toggle(branch.id)}
                className="size-4 rounded border-input"
              />
              {branch.name}
            </label>
          ))}
        </div>
        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
          <Button type="button" onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RoleSelect({
  roles,
  value,
  onChange,
  disabled,
}: {
  roles: Role[];
  value: string;
  onChange: (role: string) => void;
  disabled?: boolean;
}) {
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      className="h-8 rounded-md border border-input bg-transparent px-2 text-sm outline-none disabled:opacity-50"
    >
      {roles.map((role) => (
        <option key={role.id} value={role.name}>
          {role.name}
        </option>
      ))}
    </select>
  );
}

export default function UsersPage() {
  const { me } = useMe();
  const confirm = useConfirm();
  const [users, setUsers] = useState<CompanyUser[] | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [branchAccessUser, setBranchAccessUser] = useState<CompanyUser | null>(null);

  function loadUsers() {
    api.users.list().then(setUsers).catch(() => setUsers([]));
  }

  useEffect(() => {
    loadUsers();
    api.roles.list().then((r) => {
      setRoles(r);
      setRole((current) => current || r.find((role) => role.name === "employee")?.name || r[0]?.name || "");
    });
    api.branches.list().then((res) => setBranches(res.data));
  }, []);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    try {
      await api.users.invite({ name, email, password, role });
      notifySuccess("Teammate invited", `${email} can now sign in.`);
      setName("");
      setEmail("");
      setPassword("");
      setOpen(false);
      loadUsers();
    } catch (err) {
      notifyError(err);
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  async function handleRoleChange(user: CompanyUser, newRole: string) {
    try {
      await api.users.updateRole(user.id, newRole);
      notifySuccess(`${user.name} is now ${newRole}`);
    } catch (err) {
      notifyError(err);
      notifyError(err);
    }
    loadUsers();
  }

  async function handleToggleActive(user: CompanyUser) {
    try {
      await api.users.setActive(user.id, !user.is_active);
      notifySuccess(`${user.name} ${user.is_active ? "deactivated" : "reactivated"}`);
    } catch (err) {
      notifyError(err);
      notifyError(err);
    }
    loadUsers();
  }

  async function handleRemove(user: CompanyUser) {
    const ok = await confirm({
      title: `Remove ${user.name}?`,
      description: "They will lose access immediately. This can't be undone.",
      confirmLabel: "Remove",
      destructive: true,
    });
    if (!ok) return;
    try {
      await api.users.remove(user.id);
      notifySuccess(`${user.name} removed`);
    } catch (err) {
      notifyError(err);
      notifyError(err);
    }
    loadUsers();
  }

  const canManage = me?.permissions.includes("users.manage") ?? false;
  const canManageRoles = me?.permissions.includes("roles.view") ?? false;

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex w-full flex-col gap-6">
        <PageHeader
          title="Users"
          description={
            canManageRoles ? (
              <Link href="/dashboard/roles" className="hover:underline">
                Manage roles &amp; permissions →
              </Link>
            ) : undefined
          }
          action={
            canManage && (
              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger
                  render={
                    <Button>
                      <Plus className="size-4" />
                      Invite user
                    </Button>
                  }
                />
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Invite a teammate</DialogTitle>
                    <DialogDescription>Creates their login and assigns a role.</DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleInvite} className="flex flex-col gap-4">
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="name">Name</Label>
                      <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="password">Temporary password</Label>
                      <Input
                        id="password"
                        type="password"
                        required
                        minLength={8}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="role">Role</Label>
                      <RoleSelect roles={roles} value={role} onChange={setRole} />
                    </div>
                    {error && <Alert variant="destructive">{error}</Alert>}
                    <DialogFooter>
                      <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
                      <Button type="submit" disabled={saving}>
                        {saving ? "Inviting…" : "Invite"}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            )
          }
        />

        {users === null && <p className="text-sm text-muted-foreground">Loading…</p>}

        {users?.length === 0 && (
          <EmptyState
            icon={KeyRound}
            title="No users yet"
            description="Invite your first teammate to give them access."
          />
        )}

        {users && users.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                {branches.length > 0 && <TableHead>Branch access</TableHead>}
                {canManage && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => {
                const isSelf = user.id === me?.user.id;

                return (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">
                      {user.name} {isSelf && <span className="text-muted-foreground">(you)</span>}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{user.email}</TableCell>
                    <TableCell>
                      {canManage && !isSelf ? (
                        <RoleSelect
                          roles={roles}
                          value={user.role ?? ""}
                          onChange={(newRole) => handleRoleChange(user, newRole)}
                        />
                      ) : (
                        <Badge variant="outline">{user.role ?? "no role"}</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {user.is_active ? (
                        <Badge variant="success">Active</Badge>
                      ) : (
                        <Badge variant="secondary">Deactivated</Badge>
                      )}
                    </TableCell>
                    {branches.length > 0 && (
                      <TableCell>
                        {user.branch_ids && user.branch_ids.length > 0 ? (
                          <span className="flex flex-wrap gap-1">
                            {user.branch_ids.map((id) => (
                              <Badge key={id} variant="info">
                                {branches.find((b) => b.id === id)?.name ?? `#${id}`}
                              </Badge>
                            ))}
                          </span>
                        ) : (
                          <Badge variant="outline">All branches</Badge>
                        )}
                      </TableCell>
                    )}
                    {canManage && (
                      <TableCell className="text-right">
                        {!isSelf && (
                          <div className="flex justify-end gap-2">
                            {branches.length > 0 && (
                              <Button variant="outline" size="sm" onClick={() => setBranchAccessUser(user)}>
                                Branch access
                              </Button>
                            )}
                            <Button variant="outline" size="sm" onClick={() => handleToggleActive(user)}>
                              {user.is_active ? "Deactivate" : "Activate"}
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => handleRemove(user)}>
                              Remove
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      <BranchAccessDialog
        key={branchAccessUser?.id ?? "none"}
        user={branchAccessUser}
        branches={branches}
        open={branchAccessUser !== null}
        onOpenChange={(isOpen) => {
          if (!isOpen) setBranchAccessUser(null);
        }}
        onSaved={loadUsers}
      />
    </div>
  );
}
