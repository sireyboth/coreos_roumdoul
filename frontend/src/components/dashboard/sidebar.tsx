"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import {
  Boxes,
  Calculator,
  CircleUserRound,
  Clock,
  Contact,
  LogOut,
  Lock,
  ShoppingCart,
  UserCog,
  Warehouse,
  type LucideIcon,
} from "lucide-react";
import { canSee, homeFor, NAV_GROUPS } from "@/components/dashboard/nav";
import { useMe } from "@/contexts/me-context";
import { cn } from "@/lib/utils";

const MODULES: Record<string, { label: string; icon: LucideIcon }> = {
  attendance: { label: "Attendance", icon: Clock },
  hr: { label: "HR", icon: UserCog },
  payroll: { label: "Payroll", icon: Calculator },
  pos: { label: "POS", icon: ShoppingCart },
  inventory: { label: "Inventory", icon: Warehouse },
  crm: { label: "CRM", icon: Contact },
  accounting: { label: "Accounting", icon: Calculator },
};

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { me } = useMe();
  const [hovered, setHovered] = useState<string | null>(null);

  const groups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => me && canSee(item, me)),
  })).filter((group) => group.items.length > 0);

  return (
    <nav className="flex flex-col gap-5" onMouseLeave={() => setHovered(null)}>
      {groups.map((group) => (
        <div key={group.label} className="flex flex-col gap-0.5">
          <p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">
            {group.label}
          </p>
          {group.items.map((item) => {
            // Corrections etc. live under a nav item's URL — keep the parent lit.
            const active =
              item.href === "/dashboard"
                ? pathname === item.href
                : pathname === item.href || pathname.startsWith(item.href + "/");
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                onMouseEnter={() => setHovered(item.href)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors",
                  // Plain CSS, not an animated element: it has to show the
                  // instant the route changes, with no hover needed.
                  active && "bg-sidebar-primary/12 ring-1 ring-sidebar-primary/30 dark:bg-sidebar-primary/20 dark:ring-sidebar-primary/40",
                )}
              >
                {hovered === item.href && !active && (
                  <motion.div
                    layoutId="sidebar-hover-pill"
                    className="absolute inset-0 rounded-lg bg-sidebar-accent"
                    transition={{ type: "spring", stiffness: 500, damping: 35 }}
                  />
                )}
                <span
                  className={cn(
                    "relative z-10 flex items-center gap-3 transition-colors",
                    active ? "font-semibold text-sidebar-primary dark:text-white" : "text-sidebar-foreground/75",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-7 shrink-0 items-center justify-center rounded-md bg-linear-to-br text-white shadow-sm transition-all",
                      item.tone,
                      !active && "opacity-80 saturate-75",
                    )}
                  >
                    <Icon className="size-3.5" />
                  </span>
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

export function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { me, logout } = useMe();

  const initials = me?.user.name
    ?.split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="flex h-full flex-col gap-5 p-4 text-sidebar-foreground">
      <Link href={me ? homeFor(me) : "/dashboard"} onClick={onNavigate} className="flex items-center gap-2.5 px-1">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-indigo-500 to-violet-500 text-white shadow-lg shadow-indigo-500/30">
          <Boxes className="size-4.5" />
        </div>
        <div className="min-w-0 leading-tight">
          <p className="truncate text-sm font-semibold tracking-tight">Business OS</p>
          <p className="truncate text-[11px] text-sidebar-foreground/50">{me?.company?.name ?? "Workspace"}</p>
        </div>
      </Link>

      <div className="-mr-2 flex flex-1 flex-col gap-5 overflow-y-auto pr-2">
        <SidebarNav onNavigate={onNavigate} />

        <div className="flex flex-col gap-1">
          <p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">
            Modules
          </p>
          {me &&
            Object.entries(me.modules).map(([key, enabled]) => {
              const mod = MODULES[key];
              const Icon = mod?.icon ?? Lock;

              return (
                <div key={key} className="flex items-center justify-between rounded-md px-3 py-1 text-[13px]">
                  <span
                    className={cn(
                      "flex items-center gap-2.5",
                      enabled ? "text-sidebar-foreground/75" : "text-sidebar-foreground/30",
                    )}
                  >
                    <Icon className="size-3.5 shrink-0" />
                    {mod?.label ?? key}
                  </span>
                  {enabled ? (
                    <span className="size-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px] shadow-emerald-400/70" />
                  ) : (
                    <Lock className="size-3 shrink-0 text-sidebar-foreground/25" />
                  )}
                </div>
              );
            })}
        </div>
      </div>

      <div className="flex items-center gap-1 rounded-xl border border-sidebar-border bg-sidebar-accent/60 p-1.5">
        <Link
          href="/dashboard/profile"
          onClick={onNavigate}
          className={cn(
            "flex min-w-0 flex-1 items-center gap-2.5 rounded-lg px-1.5 py-1 transition-colors hover:bg-sidebar-accent",
            pathname === "/dashboard/profile" && "bg-sidebar-accent",
          )}
        >
          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-indigo-500 to-fuchsia-500 text-xs font-semibold text-white">
            {initials || <CircleUserRound className="size-4" />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{me?.user.name}</p>
            <p className="truncate text-[11px] capitalize text-sidebar-foreground/50">
              {me?.roles[0] ?? "Member"}
            </p>
          </div>
        </Link>
        <button
          type="button"
          onClick={logout}
          aria-label="Sign out"
          title="Sign out"
          className="flex size-8 shrink-0 items-center justify-center rounded-lg text-sidebar-foreground/60 transition-colors hover:bg-red-500/10 hover:text-red-600 dark:hover:bg-red-500/15 dark:hover:text-red-300"
        >
          <LogOut className="size-4" />
        </button>
      </div>
    </div>
  );
}

export function Sidebar() {
  return (
    <aside className="h-full w-64 shrink-0 border-r border-sidebar-border bg-sidebar">
      <SidebarContent />
    </aside>
  );
}
