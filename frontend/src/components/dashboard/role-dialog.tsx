"use client";

import { useMemo, useState } from "react";
import { Lock, Search, Sparkles } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DisplayOrderField, fromSortOrder, toSortOrder } from "@/components/dashboard/display-order";
import { api, ApiError, type PermissionGroup, type Role } from "@/lib/api";
import { notifySuccess } from "@/lib/notify";
import { cn } from "@/lib/utils";

/*
 * Create or edit a role. Each area of the system is one row with a simple
 * No access / View / Manage switch (plus extras such as payroll Approve),
 * grouped into sections, with one-click starting templates.
 */

type Level = "none" | "view" | "manage";

/** Plain words for each area: its name and what access to it means. */
const AREAS: Record<string, { name: string; hint: string }> = {
  dashboard: { name: "Overview page", hint: "The company dashboard with today's numbers." },
  company: { name: "Company settings", hint: "Company profile, plan and modules." },
  branches: { name: "Branches", hint: "Branch list and details." },
  departments: { name: "Departments", hint: "Departments and their members." },
  teams: { name: "Teams", hint: "Teams and their members." },
  employees: { name: "Employees", hint: "Staff list and profiles (not pay)." },
  users: { name: "User accounts", hint: "Logins and who can sign in." },
  roles: { name: "Roles & permissions", hint: "This page — who can do what." },
  work_locations: { name: "Work locations", hint: "Places where staff can check in." },
  work_schedules: { name: "Work schedules", hint: "Shift times and rules." },
  holidays: { name: "Holidays", hint: "Public and company holidays." },
  schedules: { name: "Rosters", hint: "Who works which shift on which day." },
  attendance: { name: "Attendance", hint: "Scans, corrections, overtime, month close." },
  requests: { name: "Requests", hint: "View: send own leave/requests. Manage: approve for others." },
  leave_policies: { name: "Leave policy", hint: "Leave types and balances." },
  salary: { name: "Salaries", hint: "Each employee's pay, tax details and allowances." },
  payroll: { name: "Payroll", hint: "Manage: prepare pay runs, settings, adjustments. Approve: sign runs off." },
};

const SECTIONS: { title: string; resources: string[] }[] = [
  { title: "General", resources: ["dashboard", "company"] },
  { title: "People & organisation", resources: ["employees", "branches", "departments", "teams", "users", "roles"] },
  { title: "Time & attendance", resources: ["attendance", "schedules", "work_schedules", "work_locations", "holidays"] },
  { title: "Requests & leave", resources: ["requests", "leave_policies"] },
  { title: "Pay", resources: ["salary", "payroll"] },
];

const EXTRA_LABELS: Record<string, string> = { approve: "Approve" };

/** One-click starting points; only permissions that exist are applied. */
const TEMPLATES: { name: string; hint: string; permissions: string[] }[] = [
  { name: "Employee", hint: "Check in, own schedule, send requests", permissions: ["employees.view", "schedules.view", "holidays.view", "attendance.view", "requests.view"] },
  {
    name: "Supervisor",
    hint: "Runs a team's attendance and approvals",
    permissions: [
      "dashboard.view", "branches.view", "departments.view", "teams.view", "teams.manage", "employees.view", "employees.manage", "work_locations.view",
      "work_schedules.view", "work_schedules.manage", "holidays.view", "holidays.manage", "schedules.view", "schedules.manage", "attendance.view", "attendance.manage",
      "requests.view", "requests.manage",
    ],
  },
  {
    name: "HR office",
    hint: "Staff, attendance, leave and preparing payroll — not approving it",
    permissions: [
      "dashboard.view", "branches.view", "departments.view", "teams.view", "employees.view", "employees.manage", "work_locations.view", "work_schedules.view",
      "holidays.view", "schedules.view", "schedules.manage", "attendance.view", "attendance.manage", "requests.view", "requests.manage", "leave_policies.view",
      "leave_policies.manage", "salary.view", "salary.manage", "payroll.view", "payroll.manage",
    ],
  },
  { name: "Payroll approver", hint: "Checks and approves pay runs only", permissions: ["dashboard.view", "employees.view", "salary.view", "payroll.view", "payroll.approve"] },
];

function levelOf(group: PermissionGroup, selected: Set<string>): Level {
  if (group.permissions.some((p) => p.endsWith(".manage") && selected.has(p))) return "manage";
  if (group.permissions.some((p) => p.endsWith(".view") && selected.has(p))) return "view";
  return "none";
}

function LevelSwitch({ group, level, onChange }: { group: PermissionGroup; level: Level; onChange: (l: Level) => void }) {
  const options: Level[] = ["none", ...(group.permissions.some((p) => p.endsWith(".view")) ? (["view"] as Level[]) : []), ...(group.permissions.some((p) => p.endsWith(".manage")) ? (["manage"] as Level[]) : [])];
  const label = { none: "No access", view: "View", manage: "Manage" };

  return (
    <div role="radiogroup" aria-label={AREAS[group.resource]?.name ?? group.resource} className="inline-flex shrink-0 rounded-lg border border-border bg-muted/40 p-0.5">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          role="radio"
          aria-checked={level === o}
          onClick={() => onChange(o)}
          className={cn(
            "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
            level === o
              ? o === "none"
                ? "bg-background text-foreground shadow-sm"
                : "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {label[o]}
        </button>
      ))}
    </div>
  );
}

export function RoleDialog({
  open,
  role,
  groups,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  // null = create a new role.
  role: Role | null;
  groups: PermissionGroup[];
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(role?.name ?? "");
  const [order, setOrder] = useState(role ? fromSortOrder(role.sort_order) : "");
  const [selected, setSelected] = useState<Set<string>>(() => new Set(role?.permissions ?? []));
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const locked = role?.protected ?? false;

  const byResource = useMemo(() => new Map(groups.map((g) => [g.resource, g])), [groups]);
  const allCodes = useMemo(() => new Set(groups.flatMap((g) => g.permissions)), [groups]);
  const total = allCodes.size;

  // Sections as defined, plus any area the server knows that isn't listed yet.
  const sections = useMemo(() => {
    const listed = new Set(SECTIONS.flatMap((s) => s.resources));
    const others = groups.map((g) => g.resource).filter((r) => !listed.has(r));
    return [...SECTIONS, ...(others.length ? [{ title: "Other", resources: others }] : [])]
      .map((s) => ({ ...s, groups: s.resources.map((r) => byResource.get(r)).filter((g): g is PermissionGroup => !!g) }))
      .filter((s) => s.groups.length > 0);
  }, [groups, byResource]);

  const q = query.trim().toLowerCase();
  const matches = (g: PermissionGroup) => !q || `${AREAS[g.resource]?.name ?? g.resource} ${AREAS[g.resource]?.hint ?? ""} ${g.resource}`.toLowerCase().includes(q);

  function update(fn: (next: Set<string>) => void) {
    if (locked) return;
    setSelected((prev) => {
      const next = new Set(prev);
      fn(next);
      return next;
    });
  }

  function setLevel(group: PermissionGroup, level: Level) {
    update((next) => {
      const view = group.permissions.find((p) => p.endsWith(".view"));
      const manage = group.permissions.find((p) => p.endsWith(".manage"));
      const extras = group.permissions.filter((p) => p !== view && p !== manage);
      [view, manage].forEach((p) => p && next.delete(p));
      if (level === "none") extras.forEach((p) => next.delete(p));
      if (level !== "none" && view) next.add(view);
      if (level === "manage" && manage) next.add(manage);
    });
  }

  function toggleExtra(group: PermissionGroup, code: string) {
    update((next) => {
      if (next.has(code)) {
        next.delete(code);
      } else {
        next.add(code);
        // An extra right is useless without seeing the area.
        const view = group.permissions.find((p) => p.endsWith(".view"));
        if (view) next.add(view);
      }
    });
  }

  function applyTemplate(codes: string[]) {
    update((next) => {
      next.clear();
      codes.filter((c) => allCodes.has(c)).forEach((c) => next.add(c));
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    const permissions = [...selected].filter((c) => allCodes.has(c));
    try {
      if (role) {
        const trimmed = name.trim();
        await api.roles.update(role.id, {
          ...(trimmed && trimmed !== role.name ? { name: trimmed } : {}),
          ...(locked ? {} : { permissions }),
          sort_order: toSortOrder(order),
        });
        notifySuccess("Role updated");
      } else {
        await api.roles.create({ name: name.trim(), permissions, sort_order: toSortOrder(order) });
        notifySuccess("Role created");
      }
      onSaved();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  const count = [...selected].filter((c) => allCodes.has(c)).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[88vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <DialogHeader className="border-b border-border px-5 py-4 pr-12">
            <DialogTitle>{role ? `Edit “${role.name}”` : "Create a role"}</DialogTitle>
            <DialogDescription>
              {locked
                ? "This role's permissions are fixed. You can rename it and change where it appears in lists."
                : role
                  ? "Changes apply immediately to everyone with this role."
                  : "A role is a job position, e.g. “HR office” or “Supervisor”. Choose what it can see and do."}
            </DialogDescription>
          </DialogHeader>

          <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-5 py-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_12rem]">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="role-name">Role name</Label>
                <Input id="role-name" required maxLength={255} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. HR office" autoFocus={!role} />
              </div>
              <DisplayOrderField id="role-order" value={order} onChange={setOrder} example="the most senior role" />
            </div>

            {locked ? (
              <Alert variant="info" title="Full access">
                <span className="inline-flex items-center gap-1.5">
                  <Lock className="size-3.5" /> The company admin can always do everything, so nobody gets locked out.
                </span>
              </Alert>
            ) : (
              <>
                <div className="flex flex-col gap-2">
                  <p className="flex items-center gap-1.5 text-sm font-medium">
                    <Sparkles className="size-4 text-primary" /> Quick start
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {TEMPLATES.map((t) => (
                      <button
                        key={t.name}
                        type="button"
                        title={t.hint}
                        onClick={() => applyTemplate(t.permissions)}
                        className="rounded-full border border-border px-3 py-1 text-xs font-medium text-foreground/80 transition-colors hover:border-primary hover:bg-primary/5 hover:text-foreground"
                      >
                        {t.name}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => applyTemplate([...allCodes])}
                      className="rounded-full border border-border px-3 py-1 text-xs font-medium text-foreground/80 transition-colors hover:border-primary hover:bg-primary/5"
                    >
                      Full access
                    </button>
                    <button type="button" onClick={() => applyTemplate([])} className="rounded-full px-3 py-1 text-xs font-medium text-muted-foreground hover:text-foreground">
                      Clear all
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground">Pick one to fill everything in, then adjust below.</p>
                </div>

                <div className="relative">
                  <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find an area, e.g. payroll" className="pl-9" aria-label="Find an area" />
                </div>

                {sections.map((section) => {
                  const shown = section.groups.filter(matches);
                  if (shown.length === 0) return null;
                  const on = section.groups.filter((g) => levelOf(g, selected) !== "none").length;
                  return (
                    <section key={section.title} className="flex flex-col gap-1">
                      <div className="flex items-baseline justify-between px-1">
                        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{section.title}</h3>
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {on} of {section.groups.length} on
                        </span>
                      </div>
                      <div className="divide-y divide-border rounded-lg border border-border">
                        {shown.map((g) => {
                          const level = levelOf(g, selected);
                          const extras = g.permissions.filter((p) => !p.endsWith(".view") && !p.endsWith(".manage"));
                          const area = AREAS[g.resource] ?? { name: g.resource.replace(/_/g, " "), hint: "" };
                          return (
                            <div key={g.resource} className={cn("flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between", level === "none" && "bg-muted/20")}>
                              <div className="min-w-0">
                                <p className={cn("text-sm font-medium", level === "none" && "text-muted-foreground")}>{area.name}</p>
                                {area.hint && <p className="text-xs text-muted-foreground">{area.hint}</p>}
                              </div>
                              <div className="flex shrink-0 flex-wrap items-center gap-2">
                                <LevelSwitch group={g} level={level} onChange={(l) => setLevel(g, l)} />
                                {extras.map((code) => {
                                  const on = selected.has(code);
                                  return (
                                    <button
                                      key={code}
                                      type="button"
                                      role="switch"
                                      aria-checked={on}
                                      onClick={() => toggleExtra(g, code)}
                                      className={cn(
                                        "rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors",
                                        on ? "border-success/40 bg-success/15 text-success" : "border-border text-muted-foreground hover:text-foreground",
                                      )}
                                    >
                                      {on ? "✓ " : "+ "}
                                      {EXTRA_LABELS[code.split(".")[1]] ?? code.split(".")[1]}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  );
                })}
                {sections.every((s) => s.groups.filter(matches).length === 0) && <p className="py-6 text-center text-sm text-muted-foreground">No area matches “{query}”.</p>}
              </>
            )}
            {error && <Alert variant="destructive">{error}</Alert>}
          </div>

          <DialogFooter className="mx-0 mb-0 flex-row items-center justify-between gap-3 border-t border-border bg-muted/30 px-5 py-3 sm:justify-between">
            <span className="text-xs text-muted-foreground tabular-nums">{locked ? "All permissions" : `${count} of ${total} permissions`}</span>
            <div className="flex gap-2">
              <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
              <Button type="submit" disabled={saving || !name.trim()}>
                {saving ? "Saving…" : role ? "Save changes" : "Create role"}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
