"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { CalendarRange, KeyRound, Pencil, Plus, Trash2, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn, type DataTableFilter } from "@/components/ui/data-table";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { CreateLoginDialog } from "@/components/dashboard/create-login-dialog";
import { EmployeeAvatar } from "@/components/dashboard/employee-avatar";
import { EMPLOYMENT_STATUSES, EMPLOYMENT_TYPES, labelFor } from "@/components/dashboard/employee-form";
import { PageHeader } from "@/components/dashboard/page-header";
import { PlanLimitAlert } from "@/components/dashboard/plan-limit-alert";
import { RosterView } from "@/components/dashboard/roster-view";
import { useMe } from "@/contexts/me-context";
import { api, Branch, Department, Employee, Team } from "@/lib/api";
import { notifyError, notifySuccess } from "@/lib/notify";
import { cn } from "@/lib/utils";

type Tab = "people" | "roster";

export default function EmployeesPage() {
  const { me, refresh } = useMe();
  const confirm = useConfirm();
  const router = useRouter();
  const pathname = usePathname();

  const canPeople = me?.permissions.includes("employees.view") ?? false;
  const canRoster = me?.permissions.includes("schedules.view") ?? false;
  const canManage = me?.permissions.includes("employees.manage") ?? false;
  const canManageRoster = me?.permissions.includes("schedules.manage") ?? false;
  const canManageBranches = me?.permissions.includes("branches.manage") ?? false;

  // ?tab=roster deep-links to the roster (the old Schedule page redirects here).
  const [tab, setTab] = useState<Tab>(() =>
    typeof window !== "undefined" && new URLSearchParams(window.location.search).get("tab") === "roster" ? "roster" : "people",
  );
  // Someone who can only see one of the two never gets an empty tab.
  const activeTab: Tab = tab === "roster" ? (canRoster ? "roster" : "people") : canPeople ? "people" : "roster";

  const [employees, setEmployees] = useState<Employee[] | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  // Empty when the role can't see them (the filters then don't show at all).
  const [departments, setDepartments] = useState<Department[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loginFor, setLoginFor] = useState<Employee | null>(null);

  function load() {
    api.employees.list().then((res) => setEmployees(res.data)).catch(() => setEmployees([]));
  }

  useEffect(() => {
    if (!canPeople) return;
    load();
    api.departments.list(200).then((res) => setDepartments(res.data)).catch(() => setDepartments([]));
    api.teams.list(200).then((res) => setTeams(res.data)).catch(() => setTeams([]));
    api.branches.list().then((res) => setBranches(res.data)).catch(() => setBranches([]));
  }, [canPeople]);

  function switchTab(next: Tab) {
    setTab(next);
    window.history.replaceState(null, "", next === "roster" ? `${pathname}?tab=roster` : pathname);
  }

  async function handleDelete(employee: Employee) {
    const ok = await confirm({
      title: `Delete ${employee.name}?`,
      description:
        "Their upcoming schedule is cleared and their login is deactivated. Past attendance keeps its history. If they've only left, set their status to Terminated instead.",
      destructive: true,
    });
    if (!ok) return;

    try {
      await api.employees.remove(employee.id);
      notifySuccess(`${employee.name} deleted`);
      refresh();
    } catch (err) {
      notifyError(err);
    }
    load();
  }

  const atEmployeeLimit = me?.plan?.max_employees != null && (me.usage?.employees ?? 0) >= me.plan.max_employees;
  const open = (employee: Employee) => router.push(`/dashboard/employees/${employee.id}`);

  const columns: DataTableColumn<Employee>[] = [
    {
      id: "name",
      header: "Name",
      primary: true,
      cell: (employee) => (
        <div className="flex items-center gap-3">
          <EmployeeAvatar name={employee.name} photoUrl={employee.photo_url} />
          <div className="flex flex-col leading-tight">
            <span className="font-medium">{employee.name}</span>
            {(employee.employee_code || employee.email) && (
              <span className="text-xs text-muted-foreground">
                {[employee.employee_code, employee.email].filter(Boolean).join(" · ")}
              </span>
            )}
          </div>
        </div>
      ),
      sortValue: (employee) => employee.name,
      searchValue: (employee) => [employee.name, employee.employee_code, employee.email].filter(Boolean).join(" "),
    },
    {
      id: "branch",
      header: "Branch",
      cell: (employee) => <span className="text-muted-foreground">{employee.branch?.name ?? "—"}</span>,
      sortValue: (employee) => employee.branch?.name,
      searchValue: (employee) => employee.branch?.name,
    },
    {
      id: "department",
      header: "Department",
      cell: (employee) =>
        employee.department || employee.team ? (
          <div className="flex flex-col leading-tight">
            <span className="text-muted-foreground">{employee.department?.name ?? "—"}</span>
            {employee.team && <span className="text-xs text-muted-foreground/70">{employee.team.name}</span>}
          </div>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
      sortValue: (employee) => employee.department?.name,
      searchValue: (employee) => [employee.department?.name, employee.team?.name].filter(Boolean).join(" "),
    },
    {
      id: "job_title",
      header: "Job title",
      cell: (employee) => <span className="text-muted-foreground">{employee.job_title ?? "—"}</span>,
      sortValue: (employee) => employee.job_title,
      searchValue: (employee) => employee.job_title,
    },
    {
      id: "phone",
      header: "Phone",
      hideOnMobile: true,
      cell: (employee) => <span className="text-muted-foreground">{employee.phone ?? "—"}</span>,
      searchValue: (employee) => employee.phone,
    },
    {
      id: "type",
      header: "Type",
      cell: (employee) =>
        employee.employment_type ? (
          <Badge variant="info">{labelFor(EMPLOYMENT_TYPES, employee.employment_type)}</Badge>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
      sortValue: (employee) => employee.employment_type,
    },
    {
      id: "hired",
      header: "Hired",
      cell: (employee) => (
        <span className="text-muted-foreground">
          {employee.hire_date
            ? new Date(employee.hire_date.slice(0, 10) + "T00:00:00").toLocaleDateString([], {
                year: "numeric",
                month: "short",
                day: "numeric",
              })
            : "—"}
        </span>
      ),
      sortValue: (employee) => employee.hire_date,
    },
    {
      id: "status",
      header: "Status",
      cell: (employee) => (
        <Badge
          variant={
            employee.employment_status === "active"
              ? "success"
              : employee.employment_status === "on_leave"
                ? "warning"
                : employee.employment_status === "terminated"
                  ? "destructive"
                  : "secondary"
          }
        >
          {labelFor(EMPLOYMENT_STATUSES, employee.employment_status)}
        </Badge>
      ),
      sortValue: (employee) => employee.employment_status,
    },
    {
      id: "login",
      header: "Login",
      sortValue: (employee) => (employee.has_login ? 1 : 0),
      cell: (employee) =>
        employee.has_login ? (
          <Badge variant="outline">Has login</Badge>
        ) : canManage ? (
          <Button variant="outline" size="sm" onClick={() => setLoginFor(employee)}>
            <KeyRound className="size-3.5" />
            Create login
          </Button>
        ) : (
          <span className="text-muted-foreground">No login</span>
        ),
    },
  ];

  const filters: DataTableFilter<Employee>[] = [
    { type: "select", id: "status", label: "Status", options: EMPLOYMENT_STATUSES, getValue: (e) => e.employment_status },
    { type: "select", id: "type", label: "Type", options: EMPLOYMENT_TYPES, getValue: (e) => e.employment_type },
    {
      type: "select",
      id: "branch",
      label: "Branch",
      options: branches.map((branch) => ({ value: String(branch.id), label: branch.name })),
      getValue: (employee) => (employee.branch ? String(employee.branch.id) : null),
    },
    ...(departments.length > 0
      ? [
          {
            type: "select" as const,
            id: "department",
            label: "Department",
            options: departments.map((d) => ({ value: String(d.id), label: d.name })),
            getValue: (employee: Employee) => (employee.department ? String(employee.department.id) : null),
          },
        ]
      : []),
    ...(teams.length > 0
      ? [
          {
            type: "select" as const,
            id: "team",
            label: "Team",
            options: teams.map((t) => ({ value: String(t.id), label: t.name })),
            getValue: (employee: Employee) => (employee.team ? String(employee.team.id) : null),
          },
        ]
      : []),
    {
      type: "select",
      id: "login",
      label: "Login",
      options: [
        { value: "yes", label: "Has login" },
        { value: "no", label: "No login yet" },
      ],
      getValue: (employee) => (employee.has_login ? "yes" : "no"),
    },
  ];

  const tabs = [
    { id: "people" as const, label: "People", icon: Users, visible: canPeople },
    { id: "roster" as const, label: "Roster", icon: CalendarRange, visible: canRoster },
  ].filter((t) => t.visible);

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex w-full flex-col gap-6">
        <PageHeader
          title="Employees"
          description={
            activeTab === "roster"
              ? canManageRoster
                ? "Who works which shift, and when."
                : "Your shifts."
              : "Your team's records, photos and details."
          }
          action={
            activeTab === "people" &&
            canManage &&
            branches.length > 0 &&
            (atEmployeeLimit ? (
              <Button disabled>
                <Plus className="size-4" />
                Add employee
              </Button>
            ) : (
              <Button render={<Link href="/dashboard/employees/new" />} nativeButton={false}>
                <Plus className="size-4" />
                Add employee
              </Button>
            ))
          }
        />

        {tabs.length > 1 && (
          <div className="inline-flex self-start rounded-lg border border-border bg-card p-0.5 shadow-sm" role="tablist">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={activeTab === t.id}
                onClick={() => switchTab(t.id)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors",
                  activeTab === t.id ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <t.icon className="size-4" />
                {t.label}
              </button>
            ))}
          </div>
        )}

        {activeTab === "people" && (
          <>
            {canManage && branches.length === 0 && (
              <p className="text-sm text-muted-foreground">
                You need a branch before adding employees.{" "}
                {canManageBranches ? (
                  <Link href="/dashboard/branches" className="font-medium text-primary hover:underline">
                    Create one first →
                  </Link>
                ) : (
                  "Ask a company admin to create one."
                )}
              </p>
            )}

            <PlanLimitAlert resource="employees" />

            <DataTable
              data={employees}
              getRowId={(employee) => employee.id}
              columns={columns}
              filters={filters}
              searchPlaceholder="Search by name, code, email, phone, branch or job title…"
              initialSort={{ columnId: "name", direction: "asc" }}
              onRowClick={open}
              emptyState={{
                icon: Users,
                title: "No employees yet",
                description: "Add your first employee to start building your team directory.",
              }}
              rowActions={(employee) => (
                <>
                  <Button variant="outline" size="sm" onClick={() => open(employee)}>
                    <Pencil className="size-3.5" />
                    {canManage ? "Edit" : "View"}
                  </Button>
                  {canManage && (
                    <Button variant="destructive" size="sm" onClick={() => handleDelete(employee)}>
                      <Trash2 className="size-3.5" />
                      Delete
                    </Button>
                  )}
                </>
              )}
            />
          </>
        )}

        {activeTab === "roster" && <RosterView />}
      </div>

      <CreateLoginDialog
        key={loginFor?.id ?? "none"}
        employee={loginFor}
        onOpenChange={(isOpen) => {
          if (!isOpen) setLoginFor(null);
        }}
        onSaved={load}
      />
    </div>
  );
}
