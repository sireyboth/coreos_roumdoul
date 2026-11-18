"use client";

import { useMemo } from "react";
import { Ban, Eye, PencilLine, Star, type LucideIcon } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { canSee, NAV_GROUPS } from "@/components/dashboard/layout/nav";
import { areaOf, extrasOf, isExtra, levelOf, orderedGroups } from "@/components/dashboard/access/role-areas";
import { useMe } from "@/contexts/me-context";
import type { PermissionGroup, Role } from "@/lib/api";
import { pageLabel, useLang, useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/*
 * "What will someone with this role see and do?"
 *
 * Left: the sidebar menu they would get. It runs the same canSee() rule as the
 * real sidebar (layout/nav.ts) with this company's modules, so a page only
 * appears here if it would really appear for them.
 * Right: every area sorted into Can change / View only / Extra rights / No access,
 * using the same levelOf() as the role editor (role-areas.ts).
 *
 * Used live inside the role editor, and on its own from the Roles table.
 * Sizes are deliberately larger than the editor's: this screen is for reading.
 */

type Bucket = {
  id: "manage" | "view" | "extra" | "none";
  icon: LucideIcon;
  // Soft tint for the chips and the icon tile (repeated elements stay soft, not solid).
  tone: string;
  items: string[];
};

export function RolePreview({ permissions, groups }: { permissions: string[]; groups: PermissionGroup[] }) {
  const t = useT();
  const lang = useLang();
  const { me } = useMe();

  const selected = useMemo(() => new Set(permissions), [permissions]);

  // The menu: same filter as the real sidebar, with this company's modules.
  const menu = useMemo(() => {
    const access = { permissions, modules: me?.modules ?? {} };
    return NAV_GROUPS.map((group) => ({ ...group, items: group.items.filter((item) => canSee(item, access)) })).filter((g) => g.items.length > 0);
  }, [permissions, me?.modules]);

  // The abilities: each area lands in exactly one level bucket; extras are listed on their own.
  const buckets = useMemo<Bucket[]>(() => {
    const manage: string[] = [];
    const view: string[] = [];
    const extra: string[] = [];
    const none: string[] = [];
    for (const g of orderedGroups(groups)) {
      const name = areaOf(t, g.resource).name;
      const level = levelOf(g, selected);
      (level === "manage" ? manage : level === "view" ? view : none).push(name);
      for (const code of extrasOf(g)) {
        if (!selected.has(code)) continue;
        const action = code.split(".")[1];
        extra.push(`${name} · ${isExtra(action) ? t(`access.roleDialog.extra.${action}`) : action}`);
      }
    }
    return [
      { id: "manage", icon: PencilLine, tone: "bg-success/10 text-success ring-success/25", items: manage },
      { id: "view", icon: Eye, tone: "bg-sky-500/10 text-sky-700 ring-sky-500/25 dark:text-sky-300", items: view },
      { id: "extra", icon: Star, tone: "bg-amber-500/10 text-amber-700 ring-amber-500/25 dark:text-amber-300", items: extra },
      { id: "none", icon: Ban, tone: "bg-muted text-muted-foreground ring-border", items: none },
    ];
  }, [groups, selected, t]);

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-[17rem_1fr]">
      {/* ── Menu they will see ───────────────────────────────────── */}
      {/* Stays in view (sticky) while the abilities scroll; its own list scrolls when it is longer than the window. */}
      <section className="flex flex-col gap-2.5 md:sticky md:top-0 md:self-start">
        <h3 className="text-base font-semibold">{t("access.rolePreview.menuTitle")}</h3>
        <div className="flex max-h-[50vh] flex-col gap-4 overflow-y-auto overscroll-contain rounded-xl border border-border bg-sidebar/60 p-3 md:max-h-[calc(92vh-14rem)]">
          {menu.length === 0 ? (
            <p className="px-1 py-6 text-center text-sm text-muted-foreground">{t("access.rolePreview.menuEmpty")}</p>
          ) : (
            menu.map((group) => (
              <div key={group.id} className="flex flex-col gap-1">
                <p className="px-2 pb-0.5 text-xs font-semibold tracking-wide text-sidebar-foreground/55 uppercase">{t(`sidebar.group.${group.id}`)}</p>
                {group.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.href} className="flex items-center gap-3 rounded-lg px-2 py-1.5 text-[0.95rem] font-medium text-sidebar-foreground/85">
                      <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-md bg-linear-to-br text-white shadow-sm", item.tone)}>
                        <Icon className="size-4" />
                      </span>
                      <span className="truncate">{pageLabel(lang, item.href, item.label)}</span>
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>
        <p className="text-sm text-muted-foreground">{t("access.rolePreview.menuHint")}</p>
      </section>

      {/* ── What they can do ─────────────────────────────────────── */}
      <section className="flex flex-col gap-2.5">
        <h3 className="text-base font-semibold">{t("access.rolePreview.abilitiesTitle")}</h3>
        <div className="flex flex-col gap-3">
          {buckets.map((b) => {
            const Icon = b.icon;
            return (
              <div key={b.id} className="flex flex-col gap-3 rounded-xl border border-border p-4">
                <div className="flex items-center gap-3">
                  <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-lg ring-1", b.tone)}>
                    <Icon className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-base font-semibold">{t(`access.rolePreview.bucket.${b.id}.title`)}</p>
                    <p className="text-sm text-muted-foreground">{t(`access.rolePreview.bucket.${b.id}.hint`)}</p>
                  </div>
                  <span className={cn("rounded-full px-3 py-1 text-sm font-semibold tabular-nums ring-1", b.tone)}>{b.items.length}</span>
                </div>
                {b.items.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {b.items.map((name) => (
                      <span key={name} className={cn("rounded-lg px-3 py-1.5 text-sm font-medium ring-1", b.tone)}>
                        {name}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground italic">{t("access.rolePreview.nothing")}</p>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

/** Read-only preview of a saved role, opened from the Roles table. */
export function RolePreviewDialog({ role, groups, onOpenChange }: { role: Role; groups: PermissionGroup[]; onOpenChange: (open: boolean) => void }) {
  const t = useT();
  // The protected (admin) role always has everything, whatever is stored.
  const permissions = useMemo(() => (role.protected ? groups.flatMap((g) => g.permissions) : role.permissions), [role, groups]);

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl">
        <DialogHeader className="border-b border-border px-6 py-5 pr-12">
          <DialogTitle className="text-xl">{t("access.rolePreview.title", { name: role.name })}</DialogTitle>
          <DialogDescription className="text-sm">{t("access.rolePreview.description")}</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <RolePreview permissions={permissions} groups={groups} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
