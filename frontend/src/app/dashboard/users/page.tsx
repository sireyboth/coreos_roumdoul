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
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { ExcelActions } from "@/components/dashboard/excel/excel-actions";
import { PageHeader } from "@/components/dashboard/layout/page-header";
import { useMe } from "@/contexts/me-context";
import { api, ApiError, Branch, CompanyUser, Role } from "@/lib/api";
import { Alert } from "@/components/ui/alert";
import { exportUsers, userImport } from "@/lib/excel/specs/people";
import { notifyError, notifySuccess } from "@/lib/notify";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { useT } from "@/lib/i18n";

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
  const t = useT();
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
      notifySuccess(t("access.usersPage.branchSaved"), t(selected.length ? "access.usersPage.branchSavedSome" : "access.usersPage.branchSavedAll", { name: user.name }));
      onOpenChange(false);
      onSaved();
    } catch (err) {
      notifyError(err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("access.usersPage.branchTitle", { name: user?.name ?? "" })}</DialogTitle>
          <DialogDescription>
            {t("access.usersPage.branchDescription")}
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
          <DialogClose render={<Button type="button" variant="outline" />}>{t("common.action.cancel")}</DialogClose>
          <Button type="button" onClick={handleSave} disabled={saving}>
            {saving ? t("common.message.saving") : t("common.action.save")}
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
  const t = useT();
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
      notifySuccess(t("access.usersPage.invited"), t("access.usersPage.invitedHint", { email }));
      setName("");
      setEmail("");
      setPassword("");
      setOpen(false);
      loadUsers();
    } catch (err) {
      notifyError(err);
      setError(err instanceof ApiError ? err.message : t("common.message.somethingWrong"));
    } finally {
      setSaving(false);
    }
  }

  async function handleRoleChange(user: CompanyUser, newRole: string) {
    try {
      await api.users.updateRole(user.id, newRole);
      notifySuccess(t("access.usersPage.roleChanged", { name: user.name, role: newRole }));
    } catch (err) {
      notifyError(err);
    }
    loadUsers();
  }

  async function handleToggleActive(user: CompanyUser) {
    try {
      await api.users.setActive(user.id, !user.is_active);
      notifySuccess(t(user.is_active ? "access.usersPage.deactivatedToast" : "access.usersPage.reactivatedToast", { name: user.name }));
    } catch (err) {
      notifyError(err);
    }
    loadUsers();
  }

  async function handleRemove(user: CompanyUser) {
    const ok = await confirm({
      title: t("access.usersPage.removeTitle", { name: user.name }),
      description: t("access.usersPage.removeDescription"),
      confirmLabel: t("common.action.remove"),
      destructive: true,
    });
    if (!ok) return;
    try {
      await api.users.remove(user.id);
      notifySuccess(t("access.usersPage.removed", { name: user.name }));
    } catch (err) {
      notifyError(err);
    }
    loadUsers();
  }

  const canManage = me?.permissions.includes("users.manage") ?? false;
  const canManageRoles = me?.permissions.includes("roles.view") ?? false;


  const columns: DataTableColumn<CompanyUser>[] = [
    {
      id: "name",
      header: t("common.field.name"),
      primary: true,
      cell: (user) => (
        <span className="font-medium">
          {user.name} {user.id === me?.user.id && <span className="text-muted-foreground">{t("access.usersPage.you")}</span>}
        </span>
      ),
      sortValue: (user) => user.name,
      searchValue: (user) => [user.name, user.email, user.login_id].filter(Boolean).join(" "),
    },
    {
      id: "login",
      header: t("access.usersPage.colLogin"),
      cell: (user) => (
        <span className="break-all text-muted-foreground">
          {user.email ?? (user.login_id ? <span title={t("access.usersPage.signsInById")}>{t("access.usersPage.idPrefix", { id: user.login_id })}</span> : "—")}
        </span>
      ),
      sortValue: (user) => user.email ?? user.login_id,
    },
    {
      id: "role",
      header: t("access.usersPage.role"),
      cell: (user) =>
        canManage && user.id !== me?.user.id ? (
          <RoleSelect roles={roles} value={user.role ?? ""} onChange={(newRole) => handleRoleChange(user, newRole)} />
        ) : (
          <Badge variant="outline">{user.role ?? t("access.usersPage.noRole")}</Badge>
        ),
      sortValue: (user) => user.role,
    },
    {
      id: "status",
      header: t("common.field.status"),
      cell: (user) => (user.is_active ? <Badge variant="success">{t("common.status.active")}</Badge> : <Badge variant="secondary">{t("access.usersPage.deactivated")}</Badge>),
      sortValue: (user) => (user.is_active ? 1 : 0),
      sortLabels: [t("access.usersPage.sortDeactivatedFirst"), t("access.usersPage.sortActiveFirst")],
    },
    ...(branches.length > 0
      ? [
          {
            id: "branches",
            header: t("access.usersPage.colBranches"),
            sortValue: (user: CompanyUser) =>
              user.branch_ids?.length ? user.branch_ids.map((id) => branches.find((b) => b.id === id)?.name ?? "").join(", ") : t("access.usersPage.allBranches"),
            cell: (user: CompanyUser) =>
              user.branch_ids && user.branch_ids.length > 0 ? (
                <span className="flex flex-wrap gap-1">
                  {user.branch_ids.map((id) => (
                    <Badge key={id} variant="info">
                      {branches.find((b) => b.id === id)?.name ?? `#${id}`}
                    </Badge>
                  ))}
                </span>
              ) : (
                <Badge variant="outline">{t("access.usersPage.allBranches")}</Badge>
              ),
          },
        ]
      : []),
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex w-full flex-col gap-6">
        <PageHeader
          title={t("access.usersPage.title")}
          description={
            canManageRoles ? (
              <Link href="/dashboard/roles" className="hover:underline">
                {t("access.usersPage.manageRoles")}
              </Link>
            ) : undefined
          }
          action={
            <div className="flex flex-wrap gap-2">
              <ExcelActions onExport={exportUsers} importSpec={canManage ? userImport : undefined} onImported={loadUsers} />
              {canManage && (
                <Dialog open={open} onOpenChange={setOpen}>
                  <DialogTrigger
                    render={
                      <Button>
                        <Plus className="size-4" />
                        {t("access.usersPage.invite")}
                      </Button>
                    }
                  />
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{t("access.usersPage.inviteTitle")}</DialogTitle>
                      <DialogDescription>{t("access.usersPage.inviteDescription")}</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleInvite} className="flex flex-col gap-4">
                      <div className="flex flex-col gap-2">
                        <Label htmlFor="name">{t("common.field.name")}</Label>
                        <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} />
                      </div>
                      <div className="flex flex-col gap-2">
                        <Label htmlFor="email">{t("common.field.email")}</Label>
                        <Input
                          id="email"
                          type="email"
                          required
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                        />
                      </div>
                      <div className="flex flex-col gap-2">
                        <Label htmlFor="password">{t("access.usersPage.tempPassword")}</Label>
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
                        <Label htmlFor="role">{t("access.usersPage.role")}</Label>
                        <RoleSelect roles={roles} value={role} onChange={setRole} />
                      </div>
                      {error && <Alert variant="destructive">{error}</Alert>}
                      <DialogFooter>
                        <DialogClose render={<Button type="button" variant="outline" />}>{t("common.action.cancel")}</DialogClose>
                        <Button type="submit" disabled={saving}>
                          {saving ? t("access.usersPage.inviting") : t("access.usersPage.inviteButton")}
                        </Button>
                      </DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>
              )}
            </div>
          }
        />

        {/* Cards on a phone, a table from tablet width up — Role and the actions stay reachable on both. */}
        <DataTable
          data={users}
          getRowId={(u) => u.id}
          columns={columns}
          searchPlaceholder={t("access.usersPage.search")}
          emptyState={{
            icon: KeyRound,
            title: t("access.usersPage.empty"),
            description: t("access.usersPage.emptyHint"),
          }}
          rowActions={
            canManage
              ? (user) =>
                  user.id === me?.user.id ? null : (
                    <>
                      {branches.length > 0 && (
                        <Button variant="outline" size="sm" onClick={() => setBranchAccessUser(user)}>
                          {t("access.usersPage.branchAccess")}
                        </Button>
                      )}
                      <Button variant="outline" size="sm" onClick={() => handleToggleActive(user)}>
                        {user.is_active ? t("access.usersPage.deactivate") : t("access.usersPage.activate")}
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleRemove(user)}>
                        {t("common.action.remove")}
                      </Button>
                    </>
                  )
              : undefined
          }
        />
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
