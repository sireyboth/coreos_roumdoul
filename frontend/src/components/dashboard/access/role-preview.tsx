"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, Ban, Check, ChevronRight, Eye, Minus, PencilLine, Star, type LucideIcon } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { canSee, NAV_GROUPS, type NavItem } from "@/components/dashboard/layout/nav";
import { areaOf, extrasOf, isExtra, levelOf, orderedGroups, pageAreas, type Level } from "@/components/dashboard/access/role-areas";
import { useMe } from "@/contexts/me-context";
import type { PermissionGroup, Role } from "@/lib/api";
import { pageLabel, useLang, useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/*
 * "What will someone with this role see and do?"
 *
 * Left: the sidebar menu they would get. It runs the same canSee() rule as the
 * real sidebar (layout/nav.ts) with this company's modules, so a page only
 * appears here if it would really appear for them. Each page can be clicked.
 * Right: every area sorted into Can change / View only / Extra rights / No access,
 * using the same levelOf() as the role editor (role-areas.ts) — or, when a page
 * is picked, what they can do on that page (its areas from PAGE_AREAS).
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

const TONE: Record<Level | "extra", string> = {
  manage: "bg-success/10 text-success ring-success/25",
  view: "bg-sky-500/10 text-sky-700 ring-sky-500/25 dark:text-sky-300",
  extra: "bg-amber-500/10 text-amber-700 ring-amber-500/25 dark:text-amber-300",
  none: "bg-muted text-muted-foreground ring-border",
};

export function RolePreview({ permissions, groups }: { permissions: string[]; groups: PermissionGroup[] }) {
  const t = useT();
  const lang = useLang();
  const { me } = useMe();

  const selected = useMemo(() => new Set(permissions), [permissions]);
  const [page, setPage] = useState<string | null>(null);

  // The menu: same filter as the real sidebar, with this company's modules.
  const menu = useMemo(() => {
    const access = { permissions, modules: me?.modules ?? {} };
    return NAV_GROUPS.map((group) => ({ ...group, items: group.items.filter((item) => canSee(item, access)) })).filter((g) => g.items.length > 0);
  }, [permissions, me?.modules]);

  // The picked page, if it is still in their menu (it drops out when its access is turned off in the editor).
  const pageItem = useMemo(() => menu.flatMap((g) => g.items).find((i) => i.href === page) ?? null, [menu, page]);

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
      { id: "manage", icon: PencilLine, tone: TONE.manage, items: manage },
      { id: "view", icon: Eye, tone: TONE.view, items: view },
      { id: "extra", icon: Star, tone: TONE.extra, items: extra },
      { id: "none", icon: Ban, tone: TONE.none, items: none },
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
                  const active = page === item.href;
                  return (
                    <button
                      key={item.href}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setPage(active ? null : item.href)}
                      className={cn(
                        "group flex items-center gap-3 rounded-lg px-2 py-1.5 text-left text-[0.95rem] font-medium transition-colors",
                        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                        active ? "bg-sidebar-accent text-sidebar-accent-foreground ring-1 ring-border" : "text-sidebar-foreground/85 hover:bg-sidebar-accent/60",
                      )}
                    >
                      <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-md bg-linear-to-br text-white shadow-sm", item.tone)}>
                        <Icon className="size-4" />
                      </span>
                      <span className="min-w-0 flex-1 truncate">{pageLabel(lang, item.href, item.label)}</span>
                      <ChevronRight className={cn("size-4 shrink-0 text-muted-foreground transition-opacity", active ? "opacity-100" : "opacity-0 group-hover:opacity-100")} />
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
        <p className="text-sm text-muted-foreground">{t("access.rolePreview.menuHint")}</p>
      </section>

      {/* ── What they can do (whole system, or one picked page) ─── */}
      {pageItem ? (
        <PageDetail item={pageItem} groups={groups} selected={selected} onBack={() => setPage(null)} />
      ) : (
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
      )}
    </div>
  );
}

/** What the role can do on one page: each area the page reads, its level, and its extra rights. */
function PageDetail({ item, groups, selected, onBack }: { item: NavItem; groups: PermissionGroup[]; selected: Set<string>; onBack: () => void }) {
  const t = useT();
  const lang = useLang();
  const Icon = item.icon;

  const rows = useMemo(() => {
    const byResource = new Map(groups.map((g) => [g.resource, g]));
    return pageAreas(item)
      .map((r) => byResource.get(r))
      .filter((g): g is PermissionGroup => !!g)
      .map((g) => ({
        resource: g.resource,
        area: areaOf(t, g.resource),
        level: levelOf(g, selected),
        extras: extrasOf(g).map((code) => {
          const action = code.split(".")[1];
          return { code, on: selected.has(code), label: isExtra(action) ? t(`access.roleDialog.extra.${action}`) : action };
        }),
      }));
  }, [item, groups, selected, t]);

  return (
    <section className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-base font-semibold">{t("access.rolePreview.page.title")}</h3>
        <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground">
          <ArrowLeft className="size-4" />
          {t("access.rolePreview.page.back")}
        </button>
      </div>

      <div className="flex flex-col gap-4 rounded-xl border border-border p-4">
        <div className="flex items-center gap-3 border-b border-border pb-4">
          <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-lg bg-linear-to-br text-white shadow-sm", item.tone)}>
            <Icon className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="text-base font-semibold">{pageLabel(lang, item.href, item.label)}</p>
            <p className="text-sm text-muted-foreground">{t("access.rolePreview.page.hint")}</p>
          </div>
        </div>

        {rows.map((row) => (
          <div key={row.resource} className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[0.95rem] font-semibold">{row.area.name}</p>
              <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1", TONE[row.level])}>{t(`access.roleDialog.level.${row.level}`)}</span>
            </div>
            <p className="text-sm text-muted-foreground">{t(`access.rolePreview.page.level.${row.level}`)}</p>
            {row.area.hint && <p className="text-xs text-muted-foreground/80">{row.area.hint}</p>}
            {row.extras.length > 0 && (
              <ul className="flex flex-wrap gap-2 pt-0.5">
                {row.extras.map((x) => (
                  <li key={x.code} className={cn("inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium ring-1", x.on ? TONE.extra : TONE.none)}>
                    {x.on ? <Check className="size-3.5" /> : <Minus className="size-3.5" />}
                    {x.label}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </section>
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
