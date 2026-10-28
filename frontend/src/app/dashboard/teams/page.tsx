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
import { ExcelActions } from "@/components/dashboard/excel-actions";
import { DisplayOrderField, displayOrderColumn, fromSortOrder, toSortOrder } from "@/components/dashboard/display-order";
import { PageHeader } from "@/components/dashboard/page-header";
import { useMe } from "@/contexts/me-context";
import { api, ApiError, Department, Team } from "@/lib/api";
import { exportTeams, teamImport } from "@/lib/excel-specs/organization";
import { notifyError, notifySuccess } from "@/lib/notify";
import { useT } from "@/lib/i18n";

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
  const t = useT();
  const [name, setName] = useState(team?.name ?? "");
  const [code, setCode] = useState(team?.code ?? "");
  const [departmentId, setDepartmentId] = useState(team?.department_id != null ? String(team.department_id) : "");
  const [status, setStatus] = useState<Team["status"]>(team?.status ?? "active");
  const [sortOrder, setSortOrder] = useState(fromSortOrder(team?.sort_order));
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
      sort_order: toSortOrder(sortOrder),
    };

    try {
      if (team) {
        await api.teams.update(team.id, payload);
        notifySuccess(t("org.teamsPage.updated"));
      } else {
        await api.teams.create(payload);
        notifySuccess(t("org.teamsPage.created"));
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
          <DialogTitle>{team ? t("org.shared.editTitle", { name: team.name }) : t("org.teamsPage.addTitle")}</DialogTitle>
          <DialogDescription>{t("org.teamsPage.formDescription")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="flex flex-col gap-2 sm:col-span-2">
              <Label htmlFor="team-name">{t("common.field.name")}</Label>
              <Input id="team-name" required value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="team-code">{t("org.shared.code")}</Label>
              <Input id="team-code" value={code} onChange={(e) => setCode(e.target.value)} />
            </div>
          </div>
          {departments.length > 0 && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="team-department">{t("org.teamsPage.department")}</Label>
              <select
                id="team-department"
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
                className={SELECT_CLASS}
              >
                <option value="">{t("org.teamsPage.noDepartment")}</option>
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
              <Label htmlFor="team-status">{t("common.field.status")}</Label>
              <select
                id="team-status"
                value={status}
                onChange={(e) => setStatus(e.target.value as Team["status"])}
                className={SELECT_CLASS}
              >
                <option value="active">{t("common.status.active")}</option>
                <option value="inactive">{t("common.status.inactive")}</option>
              </select>
            </div>
          )}
          <DisplayOrderField id="team-order" value={sortOrder} onChange={setSortOrder} example={t("org.teamsPage.orderExample")} />
          {error && <Alert variant="destructive">{error}</Alert>}
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>{t("common.action.cancel")}</DialogClose>
            <Button type="submit" disabled={saving}>
              {saving ? t("common.message.saving") : team ? t("common.action.saveChanges") : t("org.teamsPage.add")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function TeamsPage() {
  const t = useT();
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
      title: t("org.shared.deleteTitle", { name: team.name }),
      description: t("org.teamsPage.deleteDescription"),
      destructive: true,
    });
    if (!ok) return;

    try {
      await api.teams.remove(team.id);
      notifySuccess(t("org.shared.deleted", { name: team.name }));
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
      header: t("common.field.name"),
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
    displayOrderColumn<Team>(),
    {
      id: "department",
      header: t("common.field.department"),
      cell: (team) => <span className="text-muted-foreground">{team.department?.name ?? "—"}</span>,
      sortValue: (team) => team.department?.name,
      searchValue: (team) => team.department?.name,
    },
    {
      id: "members",
      header: t("org.shared.colEmployees"),
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
      header: t("common.field.status"),
      cell: (team) => (
        <Badge variant={team.status === "active" ? "success" : "secondary"}>
          {team.status === "active" ? t("common.status.active") : t("common.status.inactive")}
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
            label: t("common.field.department"),
            options: departments.map((d) => ({ value: String(d.id), label: d.name })),
            getValue: (team: Team) => (team.department ? String(team.department.id) : null),
          },
        ]
      : []),
    {
      type: "select",
      id: "status",
      label: t("common.field.status"),
      options: [
        { value: "active", label: t("common.status.active") },
        { value: "inactive", label: t("common.status.inactive") },
      ],
      getValue: (team) => team.status,
    },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex w-full flex-col gap-6">
        <PageHeader
          title={t("org.teamsPage.title")}
          description={t("org.teamsPage.description")}
          action={
            <div className="flex flex-wrap gap-2">
              <ExcelActions onExport={exportTeams} importSpec={canManage ? teamImport : undefined} onImported={load} />
              {canManage && (
                <Button onClick={() => openForm(null)}>
                  <Plus className="size-4" />
                  {t("org.teamsPage.add")}
                </Button>
              )}
            </div>
          }
        />

        <DataTable
          data={teams}
          getRowId={(team) => team.id}
          columns={columns}
          filters={filters}
          searchPlaceholder={t("org.teamsPage.search")}
          emptyState={{
            icon: UsersRound,
            title: t("org.teamsPage.emptyTitle"),
            description: t("org.teamsPage.emptyDescription"),
          }}
          onRowClick={canSeeMembers ? setMembersFor : undefined}
          rowActions={
            canSeeMembers || canManage
              ? (team) => (
                  <>
                    {canSeeMembers && (
                      <Button variant="outline" size="sm" onClick={() => setMembersFor(team)}>
                        <Users className="size-3.5" />
                        {t("org.shared.members")}
                      </Button>
                    )}
                    {canManage && (
                      <>
                        <Button variant="outline" size="sm" onClick={() => openForm(team)}>
                          <Pencil className="size-3.5" />
                          {t("common.action.edit")}
                        </Button>
                        <Button variant="destructive" size="sm" onClick={() => handleDelete(team)}>
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
        kind="team"
        target={membersFor}
        canManage={canManage}
        hint={
          membersFor?.department
            ? t("org.teamsPage.membersHint", { department: membersFor.department.name })
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
