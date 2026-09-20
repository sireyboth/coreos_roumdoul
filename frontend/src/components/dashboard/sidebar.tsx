"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import {
  Boxes,
  Building2,
  Calculator,
  CalendarRange,
  CircleUserRound,
  Clock,
  Contact,
  KeyRound,
  LayoutDashboard,
  Lock,
  MapPin,
  PartyPopper,
  ShieldCheck,
  ShoppingCart,
  Timer,
  UserCog,
  Users,
  Warehouse,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { NotificationBell } from "@/components/dashboard/notification-bell";
import { ThemeToggle } from "@/components/theme-toggle";
import { useMe } from "@/contexts/me-context";
import { cn } from "@/lib/utils";

const NAV_ITEMS: { href: string; label: string; icon: LucideIcon; permission?: string; module?: string }[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/attendance", label: "Attendance", icon: Clock, permission: "attendance.view", module: "attendance" },
  { href: "/dashboard/branches", label: "Branches", icon: Building2, permission: "branches.view" },
  { href: "/dashboard/employees", label: "Employees", icon: Users, permission: "employees.view" },
  { href: "/dashboard/work-locations", label: "Work Locations", icon: MapPin, permission: "work_locations.view" },
  { href: "/dashboard/shifts", label: "Shifts", icon: Timer, permission: "shifts.view" },
  { href: "/dashboard/schedule", label: "Schedule", icon: CalendarRange, permission: "schedules.view" },
  { href: "/dashboard/holidays", label: "Holidays", icon: PartyPopper, permission: "holidays.view" },
  { href: "/dashboard/users", label: "Users", icon: KeyRound, permission: "users.view" },
  { href: "/dashboard/roles", label: "Roles", icon: ShieldCheck, permission: "roles.view" },
];

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

  const visibleNavItems = NAV_ITEMS.filter(
    (item) =>
      (!item.permission || me?.permissions.includes(item.permission)) &&
      (!item.module || me?.modules[item.module]),
  );

  return (
    <nav className="flex flex-col gap-1" onMouseLeave={() => setHovered(null)}>
      {visibleNavItems.map((item) => {
        const active = pathname === item.href;
        const Icon = item.icon;

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            onMouseEnter={() => setHovered(item.href)}
            className="relative rounded-md px-3 py-2 text-sm font-medium"
          >
            {hovered === item.href && !active && (
              <motion.div
                layoutId="sidebar-hover-pill"
                className="absolute inset-0 rounded-md bg-sidebar-accent"
                transition={{ type: "spring", stiffness: 500, damping: 35 }}
              />
            )}
            {active && (
              <motion.div
                layoutId="sidebar-active-pill"
                className="absolute inset-0 rounded-md bg-sidebar-primary"
                transition={{ type: "spring", stiffness: 500, damping: 35 }}
              />
            )}
            <span
              className={cn(
                "relative z-10 flex items-center gap-2.5 transition-colors",
                active ? "text-sidebar-primary-foreground" : "text-sidebar-foreground/80",
              )}
            >
              <Icon className="size-4 shrink-0" />
              {item.label}
            </span>
          </Link>
        );
      })}
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
    <div className="flex h-full flex-col gap-5 p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
            <Boxes className="size-4" />
          </div>
          <span className="truncate text-sm font-semibold tracking-tight text-sidebar-foreground">
            Business OS
          </span>
        </div>
        <div className="flex items-center gap-1">
          <NotificationBell />
          <ThemeToggle />
        </div>
      </div>

      <Link
        href="/dashboard/profile"
        onClick={onNavigate}
        className="flex items-center justify-between gap-2 rounded-lg bg-sidebar-accent/60 px-3 py-2 transition-colors hover:bg-sidebar-accent"
      >
        <span className="truncate text-sm font-medium text-sidebar-accent-foreground">
          {me?.company?.name ?? "Workspace"}
        </span>
        {me?.company?.status && (
          <Badge variant="outline" className="shrink-0 text-[10px] capitalize">
            {me.company.status}
          </Badge>
        )}
      </Link>

      <SidebarNav onNavigate={onNavigate} />

      <Separator className="bg-sidebar-border" />

      <div className="flex flex-1 flex-col gap-1 overflow-y-auto">
        <p className="px-3 text-xs font-semibold uppercase tracking-wide text-sidebar-foreground/40">
          Modules
        </p>
        {me &&
          Object.entries(me.modules).map(([key, enabled]) => {
            const module = MODULES[key];
            const Icon = module?.icon ?? Lock;

            return (
              <div
                key={key}
                className={cn(
                  "group flex items-center justify-between rounded-md px-3 py-1.5 text-sm transition-colors",
                  enabled && "hover:bg-sidebar-accent",
                )}
              >
                <span
                  className={cn(
                    "flex items-center gap-2.5",
                    enabled ? "text-sidebar-foreground/80" : "text-sidebar-foreground/35",
                  )}
                >
                  <Icon className="size-4 shrink-0" />
                  {module?.label ?? key}
                </span>
                {enabled ? (
                  <span className="size-1.5 rounded-full bg-emerald-500" />
                ) : (
                  <Lock className="size-3 shrink-0 text-sidebar-foreground/30" />
                )}
              </div>
            );
          })}
      </div>

      <Separator className="bg-sidebar-border" />

      <Link
        href="/dashboard/profile"
        onClick={onNavigate}
        className={cn(
          "flex items-center gap-3 rounded-md px-3 py-2 transition-colors hover:bg-sidebar-accent",
          pathname === "/dashboard/profile" && "bg-sidebar-accent",
        )}
      >
        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-sidebar-primary text-xs font-semibold text-sidebar-primary-foreground">
          {initials || <CircleUserRound className="size-4" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-sidebar-foreground">
            {me?.user.name}
          </p>
          <p className="truncate text-xs text-sidebar-foreground/60">View profile</p>
        </div>
      </Link>

      <Button variant="outline" size="sm" onClick={logout}>
        Sign out
      </Button>
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
