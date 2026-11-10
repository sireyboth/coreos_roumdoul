"use client";

import { CalendarDays, CircleAlert, KeyRound, Pencil, Phone, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmployeeAvatar } from "@/components/dashboard/employees/employee-avatar";
import { labelIn, statusVariant } from "@/components/dashboard/employees/employee-form";
import { useProbationCountdown } from "@/components/dashboard/employees/probation-card";
import type { Employee } from "@/lib/api";
import { dateLocale, useLang, useT } from "@/lib/i18n";
import { probationProgress } from "@/lib/probation";
import { cn } from "@/lib/utils";

type Props = {
  /** The current page's employees, already searched, filtered and sorted by the DataTable. */
  employees: Employee[];
  checkbox: (employee: Employee) => React.ReactNode;
  isSelected: (employee: Employee) => boolean;
  /** Everyone matching the search and filters (all pages), for the branch totals. */
  allEmployees: Employee[];
  /** While anything is ticked, every card shows its tick box (so more can be ticked without hovering). */
  anySelected: boolean;
  canManage: boolean;
  onOpen: (employee: Employee) => void;
  onDelete: (employee: Employee) => void;
  onCreateLogin: (employee: Employee) => void;
};

// One colour per status, used for the bar and the status word (same tones as the status badges).
const TONE = {
  success: { bar: "bg-success", text: "text-success" },
  info: { bar: "bg-info", text: "text-info" },
  warning: { bar: "bg-warning", text: "text-warning" },
  destructive: { bar: "bg-destructive", text: "text-destructive" },
  secondary: { bar: "bg-muted-foreground/40", text: "text-muted-foreground" },
} as const;

/**
 * Employees as profile cards, one section per branch. Sections keep the order
 * the rows arrive in (so the chosen sort — display order by default — still
 * decides who comes first), and people without a branch go last.
 */
export function EmployeeCardGrid({ employees, checkbox, isSelected, allEmployees, anySelected, canManage, onOpen, onDelete, onCreateLogin }: Props) {
  const t = useT();

  // Branch totals across every page, so "Branch A" says 60 even when this page shows 24 of them.
  const totals = new Map<string, number>();
  for (const employee of allEmployees) {
    const key = employee.branch ? String(employee.branch.id) : "none";
    totals.set(key, (totals.get(key) ?? 0) + 1);
  }

  const sections = new Map<string, { name: string | null; people: Employee[] }>();
  for (const employee of employees) {
    const key = employee.branch ? String(employee.branch.id) : "none";
    if (!sections.has(key)) sections.set(key, { name: employee.branch?.name ?? null, people: [] });
    sections.get(key)!.people.push(employee);
  }
  const ordered = [...sections.entries()].sort(([a], [b]) => Number(a === "none") - Number(b === "none"));

  return (
    <div className="flex flex-col gap-8">
      {ordered.map(([key, section]) => (
        <section key={key} className="flex flex-col gap-3">
          <header className="flex items-center gap-2">
            <span className="size-2.5 rounded-full bg-linear-to-br from-indigo-500 to-fuchsia-500" />
            <h2 className="text-base font-medium text-muted-foreground">{section.name ?? t("employees.listPage.noBranch")}</h2>
            {/* "24 / 60" when the branch carries on to another page, else just "60". */}
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium tabular-nums text-muted-foreground">
              {section.people.length < (totals.get(key) ?? 0) ? `${section.people.length} / ${totals.get(key)}` : section.people.length}
            </span>
          </header>

          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {section.people.map((employee) => (
              <EmployeeCard
                key={employee.id}
                employee={employee}
                checkbox={checkbox(employee)}
                selected={isSelected(employee)}
                showControls={anySelected}
                canManage={canManage}
                onOpen={onOpen}
                onDelete={onDelete}
                onCreateLogin={onCreateLogin}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function EmployeeCard({
  employee,
  checkbox,
  selected,
  showControls,
  canManage,
  onOpen,
  onDelete,
  onCreateLogin,
}: {
  employee: Employee;
  checkbox: React.ReactNode;
  selected: boolean;
  showControls: boolean;
  canManage: boolean;
  onOpen: (employee: Employee) => void;
  onDelete: (employee: Employee) => void;
  onCreateLogin: (employee: Employee) => void;
}) {
  const t = useT();
  const lang = useLang();
  const countdown = useProbationCountdown();

  const tone = TONE[statusVariant(employee.employment_status)];
  // On probation the bar shows how far through they are; otherwise it's a full bar in the status colour.
  const probationEnd = employee.employment_status === "probation" ? employee.probation_end_date : null;
  const progress = probationEnd ? probationProgress(employee.hire_date, probationEnd) : null;
  const left = probationEnd ? countdown(probationEnd) : null;

  const hired = employee.hire_date
    ? new Date(employee.hire_date.slice(0, 10) + "T00:00:00").toLocaleDateString(dateLocale(lang), {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : null;

  return (
    <li
      onClick={() => onOpen(employee)}
      className={cn(
        "group relative flex cursor-pointer flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-xs transition hover:border-primary/40 hover:shadow-md",
        selected && "border-primary ring-2 ring-primary/30",
      )}
    >
      {/*
        Tick box and actions. Hidden until hover only on devices that HAVE a mouse
        (`hover: hover`) — phones and tablets (iPad) always see them, so nothing
        tappable is ever invisible. Shown on every card while anything is ticked.
        Clicks here don't open the profile.
      */}
      <div
        className={cn(
          "absolute right-3 top-3 flex items-center gap-1 transition-opacity",
          !selected && !showControls && "[@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:focus-within:opacity-100",
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {canManage && !employee.has_login && (
          <Button variant="ghost" size="icon-xs" title={t("employees.shared.createLogin")} aria-label={t("employees.shared.createLogin")} onClick={() => onCreateLogin(employee)}>
            <KeyRound className="size-3.5" />
          </Button>
        )}
        <Button variant="ghost" size="icon-xs" title={canManage ? t("common.action.edit") : t("common.action.view")} aria-label={canManage ? t("common.action.edit") : t("common.action.view")} onClick={() => onOpen(employee)}>
          <Pencil className="size-3.5" />
        </Button>
        {canManage && (
          <Button variant="ghost" size="icon-xs" className="text-destructive hover:text-destructive" title={t("common.action.delete")} aria-label={t("common.action.delete")} onClick={() => onDelete(employee)}>
            <Trash2 className="size-3.5" />
          </Button>
        )}
        {checkbox && <span className="flex px-1">{checkbox}</span>}
      </div>

      {/* Photo + who they are. */}
      <div className="flex items-center gap-3.5 pr-20">
        <EmployeeAvatar name={employee.name} photoUrl={employee.photo_url} className="size-14 text-base ring-2 ring-violet-500/30 ring-offset-2 ring-offset-card" />
        <div className="min-w-0">
          <p className="truncate font-semibold leading-snug">{employee.name}</p>
          {employee.name_km && (
            <p lang="km" className="truncate text-sm leading-relaxed text-muted-foreground">
              {employee.name_km}
            </p>
          )}
          <p className="truncate text-sm text-muted-foreground">{employee.job_title ?? "—"}</p>
        </div>
      </div>

      {/* Status bar + one line under it. */}
      <div className="flex flex-col gap-1.5">
        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
          <div className={cn("h-full rounded-full", tone.bar)} style={{ width: `${Math.round((progress ?? 1) * 100)}%` }} />
        </div>
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="truncate text-muted-foreground">
            {[employee.employee_code, employee.employment_type && labelIn(lang, "type", employee.employment_type)].filter(Boolean).join(" · ") || "—"}
          </span>
          <span className={cn("shrink-0 font-medium", tone.text)}>
            {labelIn(lang, "status", employee.employment_status)}
            {progress != null && ` · ${Math.round(progress * 100)}%`}
          </span>
        </div>
        {/* Probation countdown in plain sight ("12 days left", "Overdue by 10 days"), not only on hover. */}
        {left && (
          <p className={cn("inline-flex items-center gap-1 text-xs font-medium", TONE[left.tone].text)}>
            {left.tone === "destructive" && <CircleAlert className="size-3.5" />}
            {left.text}
          </p>
        )}
      </div>

      {/* Contact pills. */}
      <div className="flex flex-wrap gap-2 text-xs">
        <span className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-muted-foreground">
          <Phone className="size-3 shrink-0 text-emerald-500" />
          <span className="truncate">{employee.phone ?? "—"}</span>
        </span>
        <span className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-muted-foreground" title={t("employees.shared.hired")}>
          <CalendarDays className="size-3 shrink-0 text-violet-500" />
          <span className="truncate">{hired ?? "—"}</span>
        </span>
      </div>
    </li>
  );
}
