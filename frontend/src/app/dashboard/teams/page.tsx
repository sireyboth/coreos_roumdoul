"use client";

import { useEffect, useState } from "react";
import { Pencil, Plus, Trash2, Users, UsersRound } from "lucide-react";
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
import { api, ApiError, Department, Team } from "@/lib/api";
import { notifyError, notifySuccess } from "@/lib/notify";

const SELECT_CLASS = "h-9 rounded-md border border-input bg-transparent px-3 text-sm outline-none";

function TeamFormDialog({
  team,
  departments,
  open,
  onOpenChange,
  onSaved,
}: {
  team: Team | null;
  // Empty when the role can't see departments — the picker is then left out.
  departments: Department[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(team?.name ?? "");
  const [code, setCode] = useState(team?.code ?? "");
  const [departmentId, setDepartmentId] = useState(team?.department_id != null ? String(team.department_id) : "");
  const [status, setStatus] = useState<Team["status"]>(team?.status ?? "active");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Inactive departments can't be newly chosen, but stay listed if this team is already in one.
  const departmentOptions = departments.filter((d) => d.status === "active" || String(d.id) === departmentId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    const payload = {
      name: name.trim(),
      code: code.trim() || null,
      // Left out when the picker isn't shown, so an edit can't clear it by accident.
      ...(departments.length > 0 ? { department_id: departmentId ? Number(departmentId) : null } : {}),
      status,
    };

    try {
      if (team) {
        await api.teams.update(team.id, payload);
        notifySuccess("Team updated");
      } else {
        await api.teams.create(payload);
        notifySuccess("Team created");
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
          <DialogTitle>{team ? `Edit "${team.name}"` : "Add a team"}</DialogTitle>
          <DialogDescription>A team is a smaller group of people, usually inside a department.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="flex flex-col gap-2 sm:col-span-2">
              <Label htmlFor="team-name">Name</Label>
              <Input id="team-name" required value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="team-code">Code (optional)</Label>
              <Input id="team-code" value={code} onChange={(e) => setCode(e.target.value)} />
            </div>
          </div>
          {departments.length > 0 && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="team-department">Department (optional)</Label>
              <select
                id="team-department"
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
                className={SELECT_CLASS}
              >
                <option value="">No department</option>
                {departmentOptions.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          {team && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="team-status">Status</Label>
              <select
                id="team-status"
                value={status}
                onChange={(e) => setStatus(e.target.value as Team["status"])}
                className={SELECT_CLASS}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          )}
          {error && <Alert variant="destructive">{error}</Alert>}
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : team ? "Save changes" : "Add team"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function TeamsPage() {
  const { me } = useMe();
  const confirm = useConfirm();
  const [teams, setTeams] = useState<Team[] | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Team | null>(null);
  // Bumped on every open so the form always starts from fresh values.
  const [formKey, setFormKey] = useState(0);
  const [membersFor, setMembersFor] = useState<Team | null>(null);

  function load() {
    api.teams.list(200).then((res) => setTeams(res.data)).catch(() => setTeams([]));
  }

  useEffect(() => {
    load();
    api.departments.list(200).then((res) => setDepartments(res.data)).catch(() => setDepartments([]));
  }, []);

  function openForm(team: Team | null) {
    setEditing(team);
    setFormKey((key) => key + 1);
    setFormOpen(true);
  }

  async function handleDelete(team: Team) {
    const ok = await confirm({
      title: `Delete "${team.name}"?`,
      description: "A team that still has employees can't be deleted — move them to another team first, or set it to inactive instead.",
      destructive: true,
    });
    if (!ok) return;

    try {
      await api.teams.remove(team.id);
      notifySuccess(`"${team.name}" deleted`);
    } catch (err) {
      notifyError(err);
    }
    load();
  }

  const canManage = me?.permissions.includes("teams.manage") ?? false;
  // The member list comes from the employee list, so it needs that permission.
  const canSeeMembers = me?.permissions.includes("employees.view") ?? false;

  const columns: DataTableColumn<Team>[] = [
    {
      id: "name",
      header: "Name",
      primary: true,
      cell: (team) => (
        <div className="flex flex-col leading-tight">
          <span className="font-medium">{team.name}</span>
          {team.code && <span className="text-xs text-muted-foreground">{team.code}</span>}
        </div>
      ),
      sortValue: (team) => team.name,
      searchValue: (team) => [team.name, team.code].filter(Boolean).join(" "),
    },
    {
      id: "department",
      header: "Department",
      cell: (team) => <span className="text-muted-foreground">{team.department?.name ?? "—"}</span>,
      sortValue: (team) => team.department?.name,
      searchValue: (team) => team.department?.name,
    },
    {
      id: "members",
      header: "Employees",
      cell: (team) => (
        <span className="inline-flex items-center gap-1.5 tabular-nums">
          <Users className="size-3.5 text-muted-foreground" />
          {team.members_count ?? 0}
        </span>
      ),
      sortValue: (team) => team.members_count ?? 0,
    },
    {
      id: "status",
      header: "Status",
      cell: (team) => (
        <Badge variant={team.status === "active" ? "success" : "secondary"}>
          {team.status === "active" ? "Active" : "Inactive"}
        </Badge>
      ),
      sortValue: (team) => team.status,
    },
  ];

  const filters: DataTableFilter<Team>[] = [
    ...(departments.length > 0
      ? [
          {
            type: "select" as const,
            id: "department",
            label: "Department",
            options: departments.map((d) => ({ value: String(d.id), label: d.name })),
            getValue: (team: Team) => (team.department ? String(team.department.id) : null),
          },
        ]
      : []),
    {
      type: "select",
      id: "status",
      label: "Status",
      options: [
        { value: "active", label: "Active" },
        { value: "inactive", label: "Inactive" },
      ],
      getValue: (team) => team.status,
    },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex w-full flex-col gap-6">
        <PageHeader
          title="Teams"
          description="Smaller groups inside your departments. Employees are assigned to a team from the Employees page."
          action={
            canManage && (
              <Button onClick={() => openForm(null)}>
                <Plus className="size-4" />
                Add team
              </Button>
            )
          }
        />

        <DataTable
          data={teams}
          getRowId={(team) => team.id}
          columns={columns}
          filters={filters}
          searchPlaceholder="Search teams…"
          initialSort={{ columnId: "name", direction: "asc" }}
          emptyState={{
            icon: UsersRound,
            title: "No teams yet",
            description: "Create a team, then assign employees to it.",
          }}
          onRowClick={canSeeMembers ? setMembersFor : undefined}
          rowActions={
            canSeeMembers || canManage
              ? (team) => (
                  <>
                    {canSeeMembers && (
                      <Button variant="outline" size="sm" onClick={() => setMembersFor(team)}>
                        <Users className="size-3.5" />
                        Members
                      </Button>
                    )}
                    {canManage && (
                      <>
                        <Button variant="outline" size="sm" onClick={() => openForm(team)}>
                          <Pencil className="size-3.5" />
                          Edit
                        </Button>
                        <Button variant="destructive" size="sm" onClick={() => handleDelete(team)}>
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
        kind="team"
        target={membersFor}
        canManage={canManage}
        hint={
          membersFor?.department
            ? `Adding people here also puts them in the ${membersFor.department.name} department.`
            : undefined
        }
        onOpenChange={(isOpen) => {
          if (!isOpen) setMembersFor(null);
        }}
        onChanged={load}
      />

      <TeamFormDialog
        key={formKey}
        team={editing}
        departments={departments}
        open={formOpen}
        onOpenChange={setFormOpen}
        onSaved={load}
      />
    </div>
  );
}
