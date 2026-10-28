"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CalendarRange, Hourglass, KeyRound, Pencil, Plus, Trash2, Users } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn, type DataTableFilter } from "@/components/ui/data-table";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { CreateLoginDialog } from "@/components/dashboard/create-login-dialog";
import { ExcelActions } from "@/components/dashboard/excel-actions";
import { EmployeeAvatar } from "@/components/dashboard/employee-avatar";
import { EMPLOYMENT_STATUSES, EMPLOYMENT_TYPES, labelIn, optionsIn, statusVariant } from "@/components/dashboard/employee-form";
import { PageHeader } from "@/components/dashboard/page-header";
import { PlanLimitAlert } from "@/components/dashboard/plan-limit-alert";
import { probationDateLabel, useProbationCountdown } from "@/components/dashboard/probation-card";
import { ProbationSettingsDialog } from "@/components/dashboard/probation-settings-dialog";
import { RosterView } from "@/components/dashboard/roster-view";
import { useMe } from "@/contexts/me-context";
import { api, Branch, Department, Employee, PayItemComponent, Team } from "@/lib/api";
import { employeeImport, exportEmployees } from "@/lib/excel-specs/people";
import { dateLocale, useLang, useT } from "@/lib/i18n";
import { notifyError, notifySuccess } from "@/lib/notify";
import { cn } from "@/lib/utils";

type Tab = "people" | "roster";

function EmployeesPageContent() {
  const { me, refresh } = useMe();
  const confirm = useConfirm();
  const router = useRouter();
  const pathname = usePathname();
  const t = useT();
  const lang = useLang();

  const canPeople = me?.permissions.includes("employees.view") ?? false;
  const canRoster = me?.permissions.includes("schedules.view") ?? false;
  const canManage = me?.permissions.includes("employees.manage") ?? false;
  const canManageRoster = me?.permissions.includes("schedules.manage") ?? false;
  const canManageBranches = me?.permissions.includes("branches.manage") ?? false;
  // Pay and schedule columns appear in the Excel files only for people allowed to see / change them.
  const canSeeSalary = me?.permissions.includes("salary.view") ?? false;
  const canEditSalary = me?.permissions.includes("salary.manage") ?? false;
  const payroll = Boolean(me?.modules.payroll);
  // The import has one column per allowance or deduction, so it needs them before reading a file.
  const [payItems, setPayItems] = useState<PayItemComponent[]>([]);
  useEffect(() => {
    if (canEditSalary && payroll) api.employeePay.itemOptions().then(setPayItems).catch(() => setPayItems([]));
  }, [canEditSalary, payroll]);
  const importSpec = useMemo(
    () => employeeImport({ salary: canEditSalary, pay: canEditSalary && payroll, schedule: canManageRoster, items: payItems }),
    [canEditSalary, payroll, canManageRoster, payItems],
  );

  // ?tab=roster deep-links to the roster (the old Schedule page redirects here).
  // The tab lives in the address, so links open the right one even from another page.
  const tab: Tab = useSearchParams().get("tab") === "roster" ? "roster" : "people";
  // Someone who can only see one of the two never gets an empty tab.
  const activeTab: Tab = tab === "roster" ? (canRoster ? "roster" : "people") : canPeople ? "people" : "roster";

  const [employees, setEmployees] = useState<Employee[] | null>(null);
  const [employeeTotal, setEmployeeTotal] = useState(0);
  const [branches, setBranches] = useState<Branch[]>([]);
  // Empty when the role can't see them (the filters then don't show at all).
  const [departments, setDepartments] = useState<Department[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loginFor, setLoginFor] = useState<Employee | null>(null);
  const [probationRulesOpen, setProbationRulesOpen] = useState(false);
  const countdown = useProbationCountdown();

  function load() {
    api.employees
      .list()
      .then((res) => {
        setEmployees(res.data);
        setEmployeeTotal(res.total);
      })
      .catch(() => setEmployees([]));
  }

  useEffect(() => {
    if (!canPeople) return;
    load();
    api.departments.list(200).then((res) => setDepartments(res.data)).catch(() => setDepartments([]));
    api.teams.list(200).then((res) => setTeams(res.data)).catch(() => setTeams([]));
    api.branches.list().then((res) => setBranches(res.data)).catch(() => setBranches([]));
  }, [canPeople]);

  function switchTab(next: Tab) {
    // Next.js picks this up in useSearchParams, which switches the tab.
    window.history.replaceState(null, "", next === "roster" ? `${pathname}?tab=roster` : pathname);
  }

  const DELETE_WARNING = t("employees.shared.deleteWarning");

  async function handleDelete(employee: Employee) {
    const ok = await confirm({
      title: t("employees.shared.deleteTitle", { name: employee.name }),
      description: DELETE_WARNING,
      destructive: true,
    });
    if (!ok) return;

    try {
      await api.employees.remove(employee.id);
      notifySuccess(t("employees.shared.deleted", { name: employee.name }));
      refresh();
    } catch (err) {
      notifyError(err);
    }
    load();
  }

  async function handleBulkDelete(selected: Employee[], clearSelection: () => void) {
    const ok = await confirm({
      title:
        selected.length === 1
          ? t("employees.shared.deleteTitle", { name: selected[0].name })
          : t("employees.listPage.deleteManyTitle", { n: selected.length }),
      description: DELETE_WARNING,
      destructive: true,
    });
    if (!ok) return;

    try {
      const { deleted } = await api.employees.removeMany(selected.map((employee) => employee.id));
      notifySuccess(deleted === 1 ? t("employees.listPage.deletedOne") : t("employees.listPage.deletedOther", { n: deleted }));
      clearSelection();
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
      header: t("common.field.name"),
      primary: true,
      cell: (employee) => (
        <div className="flex items-center gap-3">
          <EmployeeAvatar name={employee.name} photoUrl={employee.photo_url} />
          <div className="flex flex-col leading-tight">
            <span className="font-medium">
              {employee.name}
              {employee.name_km && (
                <span lang="km" className="ml-1.5 font-normal text-muted-foreground">
                  {employee.name_km}
                </span>
              )}
            </span>
            {(employee.employee_code || employee.email) && (
              <span className="text-xs text-muted-foreground">
                {[employee.employee_code, employee.email].filter(Boolean).join(" · ")}
              </span>
            )}
          </div>
        </div>
      ),
      sortValue: (employee) => employee.name,
      searchValue: (employee) => [employee.name, employee.name_km, employee.employee_code, employee.email].filter(Boolean).join(" "),
    },
    {
      id: "order",
      header: t("common.order.column"),
      // The display order every list follows (lowest first). Set on the employee's profile.
      cell: (employee) => <span className="tabular-nums text-muted-foreground">{employee.sort_order ?? "—"}</span>,
      sortValue: (employee) => employee.sort_order,
      sortLabels: [t("common.order.lowestFirst"), t("common.order.highestFirst")],
      hideOnMobile: true,
      className: "hidden xl:table-cell w-20",
    },
    {
      id: "branch",
      header: t("common.field.branch"),
      cell: (employee) => <span className="text-muted-foreground">{employee.branch?.name ?? "—"}</span>,
      sortValue: (employee) => employee.branch?.name,
      searchValue: (employee) => employee.branch?.name,
    },
    {
      id: "department",
      header: t("common.field.department"),
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
      header: t("employees.shared.jobTitle"),
      cell: (employee) => <span className="text-muted-foreground">{employee.job_title ?? "—"}</span>,
      sortValue: (employee) => employee.job_title,
      searchValue: (employee) => employee.job_title,
    },
    {
      id: "phone",
      header: t("common.field.phone"),
      hideOnMobile: true,
      // Only on very wide screens — the table has many columns. Still searchable, and on the employee page.
      className: "hidden 2xl:table-cell",
      cell: (employee) => <span className="text-muted-foreground">{employee.phone ?? "—"}</span>,
      searchValue: (employee) => employee.phone,
      sortValue: (employee) => employee.phone,
    },
    {
      id: "type",
      header: t("common.field.type"),
      cell: (employee) =>
        employee.employment_type ? (
          <Badge variant="info">{labelIn(lang, "type", employee.employment_type)}</Badge>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
      sortValue: (employee) => employee.employment_type,
    },
    {
      id: "hired",
      header: t("employees.shared.hired"),
      cell: (employee) => (
        <span className="text-muted-foreground">
          {employee.hire_date
            ? new Date(employee.hire_date.slice(0, 10) + "T00:00:00").toLocaleDateString(dateLocale(lang), {
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
      header: t("common.field.status"),
      cell: (employee) => {
        const end = employee.employment_status === "probation" ? employee.probation_end_date : null;
        const left = end ? countdown(end) : null;
        return (
          <div className="flex flex-col items-start gap-1">
            <Badge variant={statusVariant(employee.employment_status)}>{labelIn(lang, "status", employee.employment_status)}</Badge>
            {end && left && (
              <span className={left.tone === "info" ? "text-xs text-muted-foreground" : left.tone === "warning" ? "text-xs text-warning" : "text-xs text-destructive"}>
                {t("employees.probation.listEnds", { date: probationDateLabel(end, lang) })}
              </span>
            )}
          </div>
        );
      },
      sortValue: (employee) => employee.employment_status,
    },
    {
      id: "login",
      header: t("employees.listPage.colLogin"),
      // Very wide screens only in the table; always on the phone card and in the Login filter.
      className: "hidden 2xl:table-cell",
      sortValue: (employee) => (employee.has_login ? 1 : 0),
      sortLabels: [t("employees.listPage.sortNoLoginFirst"), t("employees.listPage.sortHasLoginFirst")],
      cell: (employee) =>
        employee.has_login ? (
          <Badge variant="outline">{t("employees.shared.hasLogin")}</Badge>
        ) : canManage ? (
          <Button
            variant="outline"
            size="sm"
            onClick={(e) => {
              // The row is clickable (opens the edit page); don't let this click reach it.
              e.stopPropagation();
              setLoginFor(employee);
            }}
          >
            <KeyRound className="size-3.5" />
            {t("employees.shared.createLogin")}
          </Button>
        ) : (
          <span className="text-muted-foreground">{t("employees.shared.noLogin")}</span>
        ),
    },
  ];

  const filters: DataTableFilter<Employee>[] = [
    {
      type: "select",
      id: "status",
      label: t("common.field.status"),
      options: optionsIn(lang, "status", EMPLOYMENT_STATUSES),
      getValue: (e) => e.employment_status,
      searchable: true,
    },
    {
      type: "select",
      id: "type",
      label: t("common.field.type"),
      options: optionsIn(lang, "type", EMPLOYMENT_TYPES),
      getValue: (e) => e.employment_type,
    },
    {
      type: "select",
      id: "branch",
      label: t("common.field.branch"),
      options: branches.map((branch) => ({ value: String(branch.id), label: branch.name })),
      getValue: (employee) => (employee.branch ? String(employee.branch.id) : null),
    },
    ...(departments.length > 0
      ? [
          {
            type: "select" as const,
            id: "department",
            label: t("common.field.department"),
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
            label: t("common.field.team"),
            options: teams.map((team) => ({ value: String(team.id), label: team.name })),
            getValue: (employee: Employee) => (employee.team ? String(employee.team.id) : null),
          },
        ]
      : []),
    {
      type: "select",
      id: "login",
      label: t("employees.listPage.colLogin"),
      options: [
        { value: "yes", label: t("employees.shared.hasLogin") },
        { value: "no", label: t("employees.listPage.noLoginYet") },
      ],
      getValue: (employee) => (employee.has_login ? "yes" : "no"),
    },
  ];

  const tabs = [
    { id: "people" as const, label: t("employees.listPage.tabPeople"), icon: Users, visible: canPeople },
    { id: "roster" as const, label: t("employees.listPage.tabRoster"), icon: CalendarRange, visible: canRoster },
  ].filter((tab) => tab.visible);

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex w-full flex-col gap-6">
        <PageHeader
          title={t("employees.listPage.title")}
          description={
            activeTab === "roster"
              ? canManageRoster
                ? t("employees.listPage.descriptionRoster")
                : t("employees.listPage.descriptionOwnShifts")
              : t("employees.listPage.descriptionPeople")
          }
          action={
            activeTab === "people" && (
              <div className="flex flex-wrap gap-2">
                <ExcelActions
                  onExport={() => exportEmployees({ salary: canSeeSalary, pay: canSeeSalary && payroll, schedule: canRoster })}
                  importSpec={canManage ? importSpec : undefined}
                  onImported={() => {
                    load();
                    // The plan's headcount changed — keeps the limit banner honest.
                    refresh();
                  }}
                />
                {canManage && (
                  <Button variant="outline" onClick={() => setProbationRulesOpen(true)}>
                    <Hourglass className="size-4" />
                    {t("employees.probation.settings")}
                  </Button>
                )}
                {canManage &&
                  branches.length > 0 &&
                  (atEmployeeLimit ? (
                    <Button disabled>
                      <Plus className="size-4" />
                      {t("employees.shared.addEmployee")}
                    </Button>
                  ) : (
                    <Button render={<Link href="/dashboard/employees/new" />} nativeButton={false}>
                      <Plus className="size-4" />
                      {t("employees.shared.addEmployee")}
                    </Button>
                  ))}
              </div>
            )
          }
        />

        {tabs.length > 1 && (
          <div className="inline-flex self-start rounded-lg border border-border bg-card p-0.5 shadow-sm" role="tablist">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.id}
                onClick={() => switchTab(tab.id)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors",
                  activeTab === tab.id ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <tab.icon className="size-4" />
                {tab.label}
              </button>
            ))}
          </div>
        )}

        {activeTab === "people" && (
          <>
            {canManage && branches.length === 0 && (
              <p className="text-sm text-muted-foreground">
                {t("employees.shared.needBranch")}{" "}
                {canManageBranches ? (
                  <Link href="/dashboard/branches" className="font-medium text-primary hover:underline">
                    {t("employees.shared.createBranch")} →
                  </Link>
                ) : (
                  t("employees.shared.askAdmin")
                )}
              </p>
            )}

            <PlanLimitAlert resource="employees" />

            {employees && employeeTotal > employees.length && (
              <Alert variant="warning">
                {t("employees.listPage.tooMany", { total: employeeTotal.toLocaleString(), shown: employees.length.toLocaleString() })}
              </Alert>
            )}

            <DataTable
              data={employees}
              getRowId={(employee) => employee.id}
              columns={columns}
              filters={filters}
              searchPlaceholder={t("employees.listPage.search")}
              onRowClick={open}
              bulkActions={
                canManage
                  ? (selected, clearSelection) => (
                      <Button variant="destructive" size="sm" onClick={() => handleBulkDelete(selected, clearSelection)}>
                        <Trash2 className="size-3.5" />
                        {t("employees.listPage.deleteN", { n: selected.length })}
                      </Button>
                    )
                  : undefined
              }
              emptyState={{
                icon: Users,
                title: t("employees.shared.noEmployees"),
                description: t("employees.listPage.emptyHint"),
              }}
              rowActions={(employee) => (
                <>
                  <Button variant="outline" size="sm" onClick={() => open(employee)}>
                    <Pencil className="size-3.5" />
                    {canManage ? t("common.action.edit") : t("common.action.view")}
                  </Button>
                  {canManage && (
                    <Button variant="destructive" size="sm" onClick={() => handleDelete(employee)}>
                      <Trash2 className="size-3.5" />
                      {t("common.action.delete")}
                    </Button>
                  )}
                </>
              )}
            />
          </>
        )}

        {activeTab === "roster" && <RosterView />}
      </div>

      {probationRulesOpen && <ProbationSettingsDialog open onOpenChange={setProbationRulesOpen} />}

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

// useSearchParams needs a Suspense boundary so the page can still be prerendered.
export default function EmployeesPage() {
  return (
    <Suspense>
      <EmployeesPageContent />
    </Suspense>
  );
}
