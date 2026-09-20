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
import { MembersDialog } from "@/components/dashboard/members-dialog";
import { PageHeader } from "@/components/dashboard/page-header";
import { useMe } from "@/contexts/me-context";
import { api, ApiError, Branch, Department } from "@/lib/api";
import { notifyError, notifySuccess } from "@/lib/notify";

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
  const [name, setName] = useState(department?.name ?? "");
  const [code, setCode] = useState(department?.code ?? "");
  const [parentId, setParentId] = useState(department?.parent_department_id != null ? String(department.parent_department_id) : "");
  const [branchId, setBranchId] = useState(department?.branch_id != null ? String(department.branch_id) : "");
  const [status, setStatus] = useState<Department["status"]>(department?.status ?? "active");
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
    };

    try {
      if (department) {
        await api.departments.update(department.id, payload);
        notifySuccess("Department updated");
      } else {
        await api.departments.create(payload);
        notifySuccess("Department created");
      }
      onOpenChange(false);
      onSaved();
    } catch (err) {
      notifyError(err);
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{department ? `Edit "${department.name}"` : "Add a department"}</DialogTitle>
          <DialogDescription>Departments group your employees, and can sit inside one another.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="flex flex-col gap-2 sm:col-span-2">
              <Label htmlFor="dept-name">Name</Label>
              <Input id="dept-name" required value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="dept-code">Code (optional)</Label>
              <Input id="dept-code" placeholder="FIN" value={code} onChange={(e) => setCode(e.target.value)} />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="dept-parent">Part of (optional)</Label>
            <select id="dept-parent" value={parentId} onChange={(e) => setParentId(e.target.value)} className={SELECT_CLASS}>
              <option value="">Top level</option>
              {parentOptions.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
          {branches.length > 0 && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="dept-branch">Branch (optional)</Label>
              <select id="dept-branch" value={branchId} onChange={(e) => setBranchId(e.target.value)} className={SELECT_CLASS}>
                <option value="">Company-wide</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">Leave as company-wide if it spans every branch.</p>
            </div>
          )}
          {department && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="dept-status">Status</Label>
              <select
                id="dept-status"
                value={status}
                onChange={(e) => setStatus(e.target.value as Department["status"])}
                className={SELECT_CLASS}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
              <p className="text-xs text-muted-foreground">
                Inactive departments can&apos;t be chosen for new assignments, but keep their history.
              </p>
            </div>
          )}
          {error && <Alert variant="destructive">{error}</Alert>}
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : department ? "Save changes" : "Add department"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function DepartmentsPage() {
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
      title: `Delete "${department.name}"?`,
      description:
        "A department that still has employees, teams or sub-departments can't be deleted — move them first, or set it to inactive instead.",
      destructive: true,
    });
    if (!ok) return;

    try {
      await api.departments.remove(department.id);
      notifySuccess(`"${department.name}" deleted`);
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
      header: "Name",
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
    {
      id: "parent",
      header: "Part of",
      cell: (department) => <span className="text-muted-foreground">{department.parent?.name ?? "Top level"}</span>,
      sortValue: (department) => department.parent?.name,
      searchValue: (department) => department.parent?.name,
    },
    {
      id: "branch",
      header: "Branch",
      cell: (department) => <span className="text-muted-foreground">{department.branch?.name ?? "Company-wide"}</span>,
      sortValue: (department) => department.branch?.name,
      searchValue: (department) => department.branch?.name,
    },
    {
      id: "teams",
      header: "Teams",
      cell: (department) => <span className="tabular-nums">{department.teams_count ?? 0}</span>,
      sortValue: (department) => department.teams_count ?? 0,
    },
    {
      id: "members",
      header: "Employees",
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
      header: "Status",
      cell: (department) => (
        <Badge variant={department.status === "active" ? "success" : "secondary"}>
          {department.status === "active" ? "Active" : "Inactive"}
        </Badge>
      ),
      sortValue: (department) => department.status,
    },
  ];

  const filters: DataTableFilter<Department>[] = [
    {
      type: "select",
      id: "status",
      label: "Status",
      options: [
        { value: "active", label: "Active" },
        { value: "inactive", label: "Inactive" },
      ],
      getValue: (department) => department.status,
    },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex w-full flex-col gap-6">
        <PageHeader
          title="Departments"
          description="How your company is organized. Employees are assigned to a department from the Employees page."
          action={
            canManage && (
              <Button onClick={() => openForm(null)}>
                <Plus className="size-4" />
                Add department
              </Button>
            )
          }
        />

        <DataTable
          data={departments}
          getRowId={(department) => department.id}
          columns={columns}
          filters={filters}
          searchPlaceholder="Search departments…"
          initialSort={{ columnId: "name", direction: "asc" }}
          emptyState={{
            icon: Network,
            title: "No departments yet",
            description: "Create a department, then assign employees to it.",
          }}
          onRowClick={canSeeMembers ? setMembersFor : undefined}
          rowActions={
            canSeeMembers || canManage
              ? (department) => (
                  <>
                    {canSeeMembers && (
                      <Button variant="outline" size="sm" onClick={() => setMembersFor(department)}>
                        <Users className="size-3.5" />
                        Members
                      </Button>
                    )}
                    {canManage && (
                      <>
                        <Button variant="outline" size="sm" onClick={() => openForm(department)}>
                          <Pencil className="size-3.5" />
                          Edit
                        </Button>
                        <Button variant="destructive" size="sm" onClick={() => handleDelete(department)}>
                          <Trash2 className="size-3.5" />
                          Delete
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
        hint="People already in another department are moved here (their history is kept)."
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
