// Sidebar (components/dashboard/sidebar.tsx, nav.ts) and the language switch.
// Page names here are the full ones; nav.ts has the short ones for phone tiles.

export const sidebar = {
  // ── Menu groups ───────────────────────────────────────────────────
  group: {
    overview: "Overview",
    time: "Time & Attendance",
    payroll: "Payroll",
    organization: "Organization",
    access: "Access",
  },

  // ── Menu items by URL — read with pageLabel(lang, href) ───────────
  items: {
    "/dashboard": "Dashboard",
    "/dashboard/attendance": "Attendance",
    "/dashboard/requests": "Leave & Requests",
    "/dashboard/calendar": "Calendar",
    "/dashboard/work-schedules": "Work Schedules",
    "/dashboard/holidays": "Holidays",
    "/dashboard/leave-policy": "Leave Policy",
    "/dashboard/payroll": "Pay Runs",
    "/dashboard/payroll/adjustments": "Adjustments",
    "/dashboard/payroll/settings": "Payroll Settings",
    "/dashboard/employees": "Employees",
    "/dashboard/departments": "Departments",
    "/dashboard/teams": "Teams",
    "/dashboard/branches": "Branches",
    "/dashboard/work-locations": "Work Locations",
    "/dashboard/id-cards": "ID Cards",
    "/dashboard/birthdays": "Birthdays",
    "/dashboard/users": "Users",
    "/dashboard/roles": "Roles",
    "/dashboard/audit": "Activity Log",
    "/dashboard/attendance/corrections": "Corrections",
    "/dashboard/profile": "Profile",
  },

  // ── Modules list ──────────────────────────────────────────────────
  modules: "Modules",
  module: {
    attendance: "Attendance",
    hr: "HR",
    payroll: "Payroll",
    pos: "POS",
    inventory: "Inventory",
    crm: "CRM",
    accounting: "Accounting",
  },

  // ── Account box ───────────────────────────────────────────────────
  workspace: "Workspace",
  member: "Member",
  signOut: "Sign out",
  mainMenu: "Main menu",

  // ── Language switch (components/language-toggle.tsx) ──────────────
  language: "Language",
};
