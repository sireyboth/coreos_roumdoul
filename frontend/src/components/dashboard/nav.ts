import {
  Building2,
  CalendarDays,
  Clock,
  FileClock,
  IdCard,
  KeyRound,
  LayoutDashboard,
  MapPin,
  Network,
  PartyPopper,
  ShieldCheck,
  Timer,
  User,
  Users,
  UsersRound,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  // Full class strings so Tailwind can see them — gradient for the icon tile.
  tone: string;
  permission?: string;
  // Visible with any one of these (used when a page merges two areas, e.g. Employees + Roster).
  anyPermission?: string[];
  module?: string;
  // Reachable from other pages but not listed in the sidebar.
  hidden?: boolean;
};

export const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: "Overview",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, tone: "from-indigo-500 to-violet-500", permission: "dashboard.view" },
    ],
  },
  {
    label: "Time & Attendance",
    items: [
      { href: "/dashboard/attendance", label: "Attendance", icon: Clock, tone: "from-emerald-500 to-teal-500", permission: "attendance.view", module: "attendance" },
      { href: "/dashboard/calendar", label: "Calendar", icon: CalendarDays, tone: "from-teal-500 to-cyan-500", permission: "schedules.view" },
      { href: "/dashboard/shifts", label: "Shifts", icon: Timer, tone: "from-amber-500 to-orange-500", permission: "shifts.view" },
      { href: "/dashboard/holidays", label: "Holidays", icon: PartyPopper, tone: "from-pink-500 to-rose-500", permission: "holidays.view" },
    ],
  },
  {
    label: "Organization",
    items: [
      { href: "/dashboard/employees", label: "Employees", icon: Users, tone: "from-violet-500 to-fuchsia-500", anyPermission: ["employees.view", "schedules.view"] },
      { href: "/dashboard/departments", label: "Departments", icon: Network, tone: "from-blue-500 to-indigo-500", permission: "departments.view" },
      { href: "/dashboard/teams", label: "Teams", icon: UsersRound, tone: "from-teal-500 to-emerald-500", permission: "teams.view" },
      { href: "/dashboard/branches", label: "Branches", icon: Building2, tone: "from-cyan-500 to-sky-500", permission: "branches.view" },
      { href: "/dashboard/work-locations", label: "Work Locations", icon: MapPin, tone: "from-lime-500 to-emerald-500", permission: "work_locations.view" },
      { href: "/dashboard/id-cards", label: "ID Cards", icon: IdCard, tone: "from-rose-500 to-orange-500", permission: "employees.view", module: "id_cards" },
    ],
  },
  {
    label: "Access",
    items: [
      { href: "/dashboard/users", label: "Users", icon: KeyRound, tone: "from-orange-500 to-red-500", permission: "users.view" },
      { href: "/dashboard/roles", label: "Roles", icon: ShieldCheck, tone: "from-fuchsia-500 to-purple-500", permission: "roles.view" },
    ],
  },
];

const HIDDEN_ITEMS: NavItem[] = [
  { href: "/dashboard/attendance/corrections", label: "Corrections", icon: FileClock, tone: "from-emerald-500 to-teal-500", hidden: true },
  { href: "/dashboard/profile", label: "Profile", icon: User, tone: "from-indigo-500 to-violet-500", hidden: true },
];

const ALL_ITEMS = [...NAV_GROUPS.flatMap((g) => g.items), ...HIDDEN_ITEMS];

type Access = { permissions: string[]; modules: Record<string, boolean> };

export function canSee(item: NavItem, me: Access): boolean {
  return (
    (!item.permission || me.permissions.includes(item.permission)) &&
    (!item.anyPermission || item.anyPermission.some((p) => me.permissions.includes(p))) &&
    (!item.module || Boolean(me.modules[item.module]))
  );
}

/**
 * Where someone lands after signing in: the dashboard if their role has it,
 * otherwise the first page they can actually use (an employee's attendance).
 */
export function homeFor(me: Access): string {
  const first = NAV_GROUPS.flatMap((g) => g.items).find((item) => canSee(item, me));
  return first?.href ?? "/dashboard/profile";
}

// Longest matching href wins, so /attendance/corrections beats /attendance.
export function findNavItem(pathname: string): NavItem | undefined {
  return ALL_ITEMS.filter((i) => pathname === i.href || pathname.startsWith(i.href + "/")).sort(
    (a, b) => b.href.length - a.href.length,
  )[0];
}
