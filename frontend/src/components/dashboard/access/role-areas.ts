import type { PermissionGroup } from "@/lib/api";
import type { TKey } from "@/lib/i18n";

/*
 * Shared by the role editor (role-dialog.tsx) and the role preview
 * (role-preview.tsx): the areas of the system, how they are grouped, and how a
 * set of permission codes turns into a No access / View / Manage level.
 * Keep both screens reading from here so they never disagree.
 */

export type Level = "none" | "view" | "manage";

/** Areas with plain words (name + what access means) in access.roleDialog.area. */
export const AREAS = [
  "dashboard", "company", "audit", "branches", "departments", "teams", "employees", "users", "roles", "work_locations",
  "work_schedules", "holidays", "schedules", "attendance", "requests", "leave_policies", "salary", "payroll",
] as const;
type Area = (typeof AREAS)[number];

function isArea(resource: string): resource is Area {
  return (AREAS as readonly string[]).includes(resource);
}

/** An area's name and hint in the chosen language; an unknown one shows its code, made readable. */
export function areaOf(t: (key: TKey) => string, resource: string): { name: string; hint: string } {
  return isArea(resource)
    ? { name: t(`access.roleDialog.area.${resource}.name`), hint: t(`access.roleDialog.area.${resource}.hint`) }
    : { name: resource.replace(/_/g, " "), hint: "" };
}

export type SectionId = "general" | "people" | "time" | "requests" | "pay" | "other";

export const SECTIONS: { id: SectionId; resources: string[] }[] = [
  { id: "general", resources: ["dashboard", "company", "audit"] },
  { id: "people", resources: ["employees", "branches", "departments", "teams", "users", "roles"] },
  { id: "time", resources: ["attendance", "schedules", "work_schedules", "work_locations", "holidays"] },
  { id: "requests", resources: ["requests", "leave_policies"] },
  { id: "pay", resources: ["salary", "payroll"] },
];

/** Areas in section order, plus any area the server knows that isn't listed yet. */
export function orderedGroups(groups: PermissionGroup[]): PermissionGroup[] {
  const byResource = new Map(groups.map((g) => [g.resource, g]));
  const listed = SECTIONS.flatMap((s) => s.resources);
  const others = groups.map((g) => g.resource).filter((r) => !listed.includes(r));
  return [...listed, ...others].map((r) => byResource.get(r)).filter((g): g is PermissionGroup => !!g);
}

/** Extra rights beyond View/Manage, e.g. payroll.approve. */
export const EXTRAS = ["approve", "set_pay"] as const;

export function isExtra(action: string): action is (typeof EXTRAS)[number] {
  return (EXTRAS as readonly string[]).includes(action);
}

/** The extra codes of an area (anything that isn't .view or .manage). */
export function extrasOf(group: PermissionGroup): string[] {
  return group.permissions.filter((p) => !p.endsWith(".view") && !p.endsWith(".manage"));
}

export function levelOf(group: PermissionGroup, selected: Set<string>): Level {
  if (group.permissions.some((p) => p.endsWith(".manage") && selected.has(p))) return "manage";
  if (group.permissions.some((p) => p.endsWith(".view") && selected.has(p))) return "view";
  return "none";
}
