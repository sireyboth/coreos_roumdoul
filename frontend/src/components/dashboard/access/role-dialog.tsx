"use client";

import { useMemo, useState } from "react";
import { Lock, Search, Sparkles } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DisplayOrderField, fromSortOrder, toSortOrder } from "@/components/dashboard/shared/display-order";
import { api, ApiError, type PermissionGroup, type Role } from "@/lib/api";
import { notifySuccess } from "@/lib/notify";
import { cn } from "@/lib/utils";
import { useT, type TKey } from "@/lib/i18n";

/*
 * Create or edit a role. Each area of the system is one row with a simple
 * No access / View / Manage switch (plus extras such as payroll Approve),
 * grouped into sections, with one-click starting templates.
 */

type Level = "none" | "view" | "manage";

/** Areas with plain words (name + what access means) in access.roleDialog.area. */
const AREAS = [
  "dashboard", "company", "audit", "branches", "departments", "teams", "employees", "users", "roles", "work_locations",
  "work_schedules", "holidays", "schedules", "attendance", "requests", "leave_policies", "salary", "payroll",
] as const;
type Area = (typeof AREAS)[number];

function isArea(resource: string): resource is Area {
  return (AREAS as readonly string[]).includes(resource);
}

/** An area's name and hint in the chosen language; an unknown one shows its code, made readable. */
function areaOf(t: (key: TKey) => string, resource: string): { name: string; hint: string } {
  return isArea(resource)
    ? { name: t(`access.roleDialog.area.${resource}.name`), hint: t(`access.roleDialog.area.${resource}.hint`) }
    : { name: resource.replace(/_/g, " "), hint: "" };
}

type SectionId = "general" | "people" | "time" | "requests" | "pay" | "other";

const SECTIONS: { id: SectionId; resources: string[] }[] = [
  { id: "general", resources: ["dashboard", "company", "audit"] },
  { id: "people", resources: ["employees", "branches", "departments", "teams", "users", "roles"] },
  { id: "time", resources: ["attendance", "schedules", "work_schedules", "work_locations", "holidays"] },
  { id: "requests", resources: ["requests", "leave_policies"] },
  { id: "pay", resources: ["salary", "payroll"] },
];

const EXTRAS = ["approve", "set_pay"] as const;

function isExtra(action: string): action is (typeof EXTRAS)[number] {
  return (EXTRAS as readonly string[]).includes(action);
}

/** One-click starting points; only permissions that exist are applied. */
const TEMPLATES: { id: "employee" | "supervisor" | "hrOffice" | "payrollApprover"; permissions: string[] }[] = [
  { id: "employee", permissions: ["employees.view", "schedules.view", "holidays.view", "attendance.view", "requests.view"] },
  {
    id: "supervisor",
    permissions: [
      "dashboard.view", "branches.view", "departments.view", "teams.view", "teams.manage", "employees.view", "employees.manage", "work_locations.view",
      "work_schedules.view", "work_schedules.manage", "holidays.view", "holidays.manage", "schedules.view", "schedules.manage", "attendance.view", "attendance.manage",
      "requests.view", "requests.manage",
    ],
  },
  {
    id: "hrOffice",
    permissions: [
      "dashboard.view", "branches.view", "departments.view", "teams.view", "employees.view", "employees.manage", "work_locations.view", "work_schedules.view",
      "holidays.view", "schedules.view", "schedules.manage", "attendance.view", "attendance.manage", "requests.view", "requests.manage", "requests.set_pay", "leave_policies.view",
      "leave_policies.manage", "salary.view", "salary.manage", "payroll.view", "payroll.manage",
    ],
  },
  { id: "payrollApprover", permissions: ["dashboard.view", "employees.view", "salary.view", "payroll.view", "payroll.approve"] },
];

function levelOf(group: PermissionGroup, selected: Set<string>): Level {
  if (group.permissions.some((p) => p.endsWith(".manage") && selected.has(p))) return "manage";
  if (group.permissions.some((p) => p.endsWith(".view") && selected.has(p))) return "view";
  return "none";
}

function LevelSwitch({ group, level, onChange }: { group: PermissionGroup; level: Level; onChange: (l: Level) => void }) {
  const options: Level[] = ["none", ...(group.permissions.some((p) => p.endsWith(".view")) ? (["view"] as Level[]) : []), ...(group.permissions.some((p) => p.endsWith(".manage")) ? (["manage"] as Level[]) : [])];
  const t = useT();

  return (
    <div role="radiogroup" aria-label={areaOf(t, group.resource).name} className="inline-flex shrink-0 rounded-lg border border-border bg-muted/40 p-0.5">
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
          {t(`access.roleDialog.level.${o}`)}
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
  const t = useT();
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
    return [...SECTIONS, ...(others.length ? [{ id: "other" as const, resources: others }] : [])]
      .map((s) => ({ ...s, groups: s.resources.map((r) => byResource.get(r)).filter((g): g is PermissionGroup => !!g) }))
      .filter((s) => s.groups.length > 0);
  }, [groups, byResource]);

  const q = query.trim().toLowerCase();
  const matches = (g: PermissionGroup) => {
    const area = areaOf(t, g.resource);
    return !q || `${area.name} ${area.hint} ${g.resource}`.toLowerCase().includes(q);
  };

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
        notifySuccess(t("access.roleDialog.updated"));
      } else {
        await api.roles.create({ name: name.trim(), permissions, sort_order: toSortOrder(order) });
        notifySuccess(t("access.roleDialog.created"));
      }
      onSaved();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("common.message.somethingWrong"));
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
            <DialogTitle>{role ? t("access.roleDialog.editTitle", { name: role.name }) : t("access.roleDialog.createTitle")}</DialogTitle>
            <DialogDescription>
              {locked
                ? t("access.roleDialog.lockedDescription")
                : role
                  ? t("access.roleDialog.editDescription")
                  : t("access.roleDialog.createDescription")}
            </DialogDescription>
          </DialogHeader>

          <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-5 py-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_12rem]">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="role-name">{t("access.roleDialog.name")}</Label>
                <Input id="role-name" required maxLength={255} value={name} onChange={(e) => setName(e.target.value)} placeholder={t("access.roleDialog.namePlaceholder")} autoFocus={!role} />
              </div>
              <DisplayOrderField id="role-order" value={order} onChange={setOrder} example={t("access.roleDialog.orderExample")} />
            </div>

            {locked ? (
              <Alert variant="info" title={t("access.roleDialog.fullAccess")}>
                <span className="inline-flex items-center gap-1.5">
                  <Lock className="size-3.5" /> {t("access.roleDialog.fullAccessHint")}
                </span>
              </Alert>
            ) : (
              <>
                <div className="flex flex-col gap-2">
                  <p className="flex items-center gap-1.5 text-sm font-medium">
                    <Sparkles className="size-4 text-primary" /> {t("access.roleDialog.quickStart")}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {TEMPLATES.map((tpl) => (
                      <button
                        key={tpl.id}
                        type="button"
                        title={t(`access.roleDialog.template.${tpl.id}.hint`)}
                        onClick={() => applyTemplate(tpl.permissions)}
                        className="rounded-full border border-border px-3 py-1 text-xs font-medium text-foreground/80 transition-colors hover:border-primary hover:bg-primary/5 hover:text-foreground"
                      >
                        {t(`access.roleDialog.template.${tpl.id}.name`)}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => applyTemplate([...allCodes])}
                      className="rounded-full border border-border px-3 py-1 text-xs font-medium text-foreground/80 transition-colors hover:border-primary hover:bg-primary/5"
                    >
                      {t("access.roleDialog.fullAccess")}
                    </button>
                    <button type="button" onClick={() => applyTemplate([])} className="rounded-full px-3 py-1 text-xs font-medium text-muted-foreground hover:text-foreground">
                      {t("access.roleDialog.clearAll")}
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground">{t("access.roleDialog.quickStartHint")}</p>
                </div>

                <div className="relative">
                  <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("access.roleDialog.find")} className="pl-9" aria-label={t("access.roleDialog.findLabel")} />
                </div>

                {sections.map((section) => {
                  const shown = section.groups.filter(matches);
                  if (shown.length === 0) return null;
                  const on = section.groups.filter((g) => levelOf(g, selected) !== "none").length;
                  return (
                    <section key={section.id} className="flex flex-col gap-1">
                      <div className="flex items-baseline justify-between px-1">
                        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t(`access.roleDialog.section.${section.id}`)}</h3>
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {t("access.roleDialog.sectionCount", { on, total: section.groups.length })}
                        </span>
                      </div>
                      <div className="divide-y divide-border rounded-lg border border-border">
                        {shown.map((g) => {
                          const level = levelOf(g, selected);
                          const extras = g.permissions.filter((p) => !p.endsWith(".view") && !p.endsWith(".manage"));
                          const area = areaOf(t, g.resource);
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
                                  const action = code.split(".")[1];
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
                                      {isExtra(action) ? t(`access.roleDialog.extra.${action}`) : action}
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
                {sections.every((s) => s.groups.filter(matches).length === 0) && <p className="py-6 text-center text-sm text-muted-foreground">{t("access.roleDialog.noMatch", { query })}</p>}
              </>
            )}
            {error && <Alert variant="destructive">{error}</Alert>}
          </div>

          <DialogFooter className="mx-0 mb-0 flex-row items-center justify-between gap-3 border-t border-border bg-muted/30 px-5 py-3 sm:justify-between">
            <span className="text-xs text-muted-foreground tabular-nums">{locked ? t("access.roleDialog.allPermissions") : t("access.roleDialog.permissionCount", { n: count, total })}</span>
            <div className="flex gap-2">
              <DialogClose render={<Button type="button" variant="outline" />}>{t("common.action.cancel")}</DialogClose>
              <Button type="submit" disabled={saving || !name.trim()}>
                {saving ? t("common.message.saving") : role ? t("common.action.saveChanges") : t("access.roleDialog.create")}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
