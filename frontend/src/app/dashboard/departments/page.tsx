"use client";

import { useEffect, useState } from "react";
import { Network, Pencil, Plus, Trash2, Users } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { DataTable, type DataTableColumn, type DataTableFilter } from "@/components/ui/data-table";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MembersDialog } from "@/components/dashboard/organization/members-dialog";
import { ExcelActions } from "@/components/dashboard/excel/excel-actions";
import { DisplayOrderField, displayOrderColumn, fromSortOrder, toSortOrder } from "@/components/dashboard/shared/display-order";
import { PageHeader } from "@/components/dashboard/layout/page-header";
import { useMe } from "@/contexts/me-context";
import { api, ApiError, Branch, Department } from "@/lib/api";
import { exportDepartments, departmentImport } from "@/lib/excel/specs/organization";
import { notifyError, notifySuccess } from "@/lib/notify";
import { useT } from "@/lib/i18n";

const SELECT_CLASS = "h-9 rounded-md border border-input bg-transparent px-3 text-sm outline-none";

/** Every department beneath `id` — none of them can be picked as its parent. */
function descendantIds(id: number, all: Department[]): Set<number> {
  const found = new Set<number>();
  const queue = [id];

  while (queue.length > 0) {
    const current = queue.pop()!;
    for (const d of all) {
      if (d.parent_department_id === current && !found.has(d.id)) {
        found.add(d.id);
        queue.push(d.id);
      }
    }
  }

  return found;
}

function DepartmentFormDialog({
  department,
  departments,
  branches,
  open,
  onOpenChange,
  onSaved,
}: {
  department: Department | null;
  departments: Department[];
  branches: Branch[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const t = useT();
  const [name, setName] = useState(department?.name ?? "");
  const [code, setCode] = useState(department?.code ?? "");
  const [parentId, setParentId] = useState(department?.parent_department_id != null ? String(department.parent_department_id) : "");
  const [branchId, setBranchId] = useState(department?.branch_id != null ? String(department.branch_id) : "");
  const [status, setStatus] = useState<Department["status"]>(department?.status ?? "active");
  const [sortOrder, setSortOrder] = useState(fromSortOrder(department?.sort_order));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Not itself, and nothing that sits beneath it (that would make a loop).
  const blocked = department ? descendantIds(department.id, departments).add(department.id) : new Set<number>();
  const parentOptions = departments.filter((d) => !blocked.has(d.id));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    const payload = {
      name: name.trim(),
      code: code.trim() || null,
      parent_department_id: parentId ? Number(parentId) : null,
      branch_id: branchId ? Number(branchId) : null,
      status,
      sort_order: toSortOrder(sortOrder),
    };

    try {
      if (department) {
        await api.departments.update(department.id, payload);
        notifySuccess(t("org.departmentsPage.updated"));
      } else {
        await api.departments.create(payload);
        notifySuccess(t("org.departmentsPage.created"));
      }
      onOpenChange(false);
      onSaved();
    } catch (err) {
      notifyError(err);
      setError(err instanceof ApiError ? err.message : t("common.message.somethingWrong"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{department ? t("org.shared.editTitle", { name: department.name }) : t("org.departmentsPage.addTitle")}</DialogTitle>
          <DialogDescription>{t("org.departmentsPage.formDescription")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="flex flex-col gap-2 sm:col-span-2">
              <Label htmlFor="dept-name">{t("common.field.name")}</Label>
              <Input id="dept-name" required value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="dept-code">{t("org.shared.code")}</Label>
              <Input id="dept-code" placeholder="FIN" value={code} onChange={(e) => setCode(e.target.value)} />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="dept-parent">{t("org.departmentsPage.partOf")}</Label>
            <select id="dept-parent" value={parentId} onChange={(e) => setParentId(e.target.value)} className={SELECT_CLASS}>
              <option value="">{t("org.departmentsPage.topLevel")}</option>
              {parentOptions.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
          {branches.length > 0 && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="dept-branch">{t("org.departmentsPage.branch")}</Label>
              <select id="dept-branch" value={branchId} onChange={(e) => setBranchId(e.target.value)} className={SELECT_CLASS}>
                <option value="">{t("org.shared.companyWide")}</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">{t("org.departmentsPage.branchHint")}</p>
            </div>
          )}
          {department && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="dept-status">{t("common.field.status")}</Label>
              <select
                id="dept-status"
                value={status}
                onChange={(e) => setStatus(e.target.value as Department["status"])}
                className={SELECT_CLASS}
              >
                <option value="active">{t("common.status.active")}</option>
                <option value="inactive">{t("common.status.inactive")}</option>
              </select>
              <p className="text-xs text-muted-foreground">
                {t("org.departmentsPage.inactiveHint")}
              </p>
            </div>
          )}
          <DisplayOrderField id="dept-order" value={sortOrder} onChange={setSortOrder} example={t("org.departmentsPage.orderExample")} />
          {error && <Alert variant="destructive">{error}</Alert>}
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>{t("common.action.cancel")}</DialogClose>
            <Button type="submit" disabled={saving}>
              {saving ? t("common.message.saving") : department ? t("common.action.saveChanges") : t("org.departmentsPage.add")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function DepartmentsPage() {
  const t = useT();
  const { me } = useMe();
  const confirm = useConfirm();
  const [departments, setDepartments] = useState<Department[] | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Department | null>(null);
  // Bumped on every open so the form always starts from fresh values.
  const [formKey, setFormKey] = useState(0);
  const [membersFor, setMembersFor] = useState<Department | null>(null);

  function load() {
    api.departments.list(200).then((res) => setDepartments(res.data)).catch(() => setDepartments([]));
  }

  useEffect(() => {
    load();
    api.branches.list().then((res) => setBranches(res.data)).catch(() => setBranches([]));
  }, []);

  function openForm(department: Department | null) {
    setEditing(department);
    setFormKey((key) => key + 1);
    setFormOpen(true);
  }

  async function handleDelete(department: Department) {
    const ok = await confirm({
      title: t("org.shared.deleteTitle", { name: department.name }),
      description: t("org.departmentsPage.deleteDescription"),
      destructive: true,
    });
    if (!ok) return;

    try {
      await api.departments.remove(department.id);
      notifySuccess(t("org.shared.deleted", { name: department.name }));
    } catch (err) {
      notifyError(err);
    }
    load();
  }

  const canManage = me?.permissions.includes("departments.manage") ?? false;
  // The member list comes from the employee list, so it needs that permission.
  const canSeeMembers = me?.permissions.includes("employees.view") ?? false;

  const columns: DataTableColumn<Department>[] = [
    {
      id: "name",
      header: t("common.field.name"),
      primary: true,
      cell: (department) => (
        <div className="flex flex-col leading-tight">
          <span className="font-medium">{department.name}</span>
          {department.code && <span className="text-xs text-muted-foreground">{department.code}</span>}
        </div>
      ),
      sortValue: (department) => department.name,
      searchValue: (department) => [department.name, department.code].filter(Boolean).join(" "),
    },
    displayOrderColumn<Department>(),
    {
      id: "parent",
      header: t("org.departmentsPage.colPartOf"),
      cell: (department) => <span className="text-muted-foreground">{department.parent?.name ?? t("org.departmentsPage.topLevel")}</span>,
      sortValue: (department) => department.parent?.name,
      searchValue: (department) => department.parent?.name,
    },
    {
      id: "branch",
      header: t("common.field.branch"),
      cell: (department) => <span className="text-muted-foreground">{department.branch?.name ?? t("org.shared.companyWide")}</span>,
      sortValue: (department) => department.branch?.name,
      searchValue: (department) => department.branch?.name,
    },
    {
      id: "teams",
      header: t("org.departmentsPage.colTeams"),
      cell: (department) => <span className="tabular-nums">{department.teams_count ?? 0}</span>,
      sortValue: (department) => department.teams_count ?? 0,
    },
    {
      id: "members",
      header: t("org.shared.colEmployees"),
      cell: (department) => (
        <span className="inline-flex items-center gap-1.5 tabular-nums">
          <Users className="size-3.5 text-muted-foreground" />
          {department.members_count ?? 0}
        </span>
      ),
      sortValue: (department) => department.members_count ?? 0,
    },
    {
      id: "status",
      header: t("common.field.status"),
      cell: (department) => (
        <Badge variant={department.status === "active" ? "success" : "secondary"}>
          {department.status === "active" ? t("common.status.active") : t("common.status.inactive")}
        </Badge>
      ),
      sortValue: (department) => department.status,
    },
  ];

  const filters: DataTableFilter<Department>[] = [
    {
      type: "select",
      id: "status",
      label: t("common.field.status"),
      options: [
        { value: "active", label: t("common.status.active") },
        { value: "inactive", label: t("common.status.inactive") },
      ],
      getValue: (department) => department.status,
    },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex w-full flex-col gap-6">
        <PageHeader
          title={t("org.departmentsPage.title")}
          description={t("org.departmentsPage.description")}
          action={
            <div className="flex flex-wrap gap-2">
              <ExcelActions onExport={exportDepartments} importSpec={canManage ? departmentImport : undefined} onImported={load} />
              {canManage && (
                <Button onClick={() => openForm(null)}>
                  <Plus className="size-4" />
                  {t("org.departmentsPage.add")}
                </Button>
              )}
            </div>
          }
        />

        <DataTable
          data={departments}
          getRowId={(department) => department.id}
          columns={columns}
          filters={filters}
          searchPlaceholder={t("org.departmentsPage.search")}
          emptyState={{
            icon: Network,
            title: t("org.departmentsPage.emptyTitle"),
            description: t("org.departmentsPage.emptyDescription"),
          }}
          onRowClick={canSeeMembers ? setMembersFor : undefined}
          rowActions={
            canSeeMembers || canManage
              ? (department) => (
                  <>
                    {canSeeMembers && (
                      <Button variant="outline" size="sm" onClick={() => setMembersFor(department)}>
                        <Users className="size-3.5" />
                        {t("org.shared.members")}
                      </Button>
                    )}
                    {canManage && (
                      <>
                        <Button variant="outline" size="sm" onClick={() => openForm(department)}>
                          <Pencil className="size-3.5" />
                          {t("common.action.edit")}
                        </Button>
                        <Button variant="destructive" size="sm" onClick={() => handleDelete(department)}>
                          <Trash2 className="size-3.5" />
                          {t("common.action.delete")}
                        </Button>
                      </>
                    )}
                  </>
                )
              : undefined
          }
        />
      </div>

      <MembersDialog
        key={`members-${membersFor?.id ?? "none"}`}
        kind="department"
        target={membersFor}
        canManage={canManage}
        hint={t("org.departmentsPage.membersHint")}
        onOpenChange={(isOpen) => {
          if (!isOpen) setMembersFor(null);
        }}
        onChanged={load}
      />

      <DepartmentFormDialog
        key={formKey}
        department={editing}
        departments={departments ?? []}
        branches={branches}
        open={formOpen}
        onOpenChange={setFormOpen}
        onSaved={load}
      />
    </div>
  );
}
