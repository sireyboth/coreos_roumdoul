// Role editor dialog (components/dashboard/role-dialog.tsx)

export const roleDialog = {
  // ── Header ───────────────────────────────────────────────────────
  editTitle: "Edit “{name}”",
  createTitle: "Create a role",
  lockedDescription: "This role's permissions are fixed. You can rename it and change where it appears in lists.",
  editDescription: "Changes apply immediately to everyone with this role.",
  createDescription: "A role is a job position, e.g. “HR office” or “Supervisor”. Choose what it can see and do.",

  // ── Name & order ─────────────────────────────────────────────────
  name: "Role name",
  namePlaceholder: "e.g. HR office",
  orderExample: "the most senior role",

  // ── Full access (protected role) ─────────────────────────────────
  fullAccess: "Full access",
  fullAccessHint: "The company admin can always do everything, so nobody gets locked out.",

  // ── Quick start templates ────────────────────────────────────────
  quickStart: "Quick start",
  clearAll: "Clear all",
  quickStartHint: "Pick one to fill everything in, then adjust below.",
  template: {
    employee: { name: "Employee", hint: "Check in, own schedule, send requests" },
    supervisor: { name: "Supervisor", hint: "Runs a team's attendance and approvals" },
    hrOffice: { name: "HR office", hint: "Staff, attendance, leave and preparing payroll — not approving it" },
    payrollApprover: { name: "Payroll approver", hint: "Checks and approves pay runs only" },
  },

  // ── Area list ────────────────────────────────────────────────────
  find: "Find an area, e.g. payroll",
  findLabel: "Find an area",
  sectionCount: "{on} of {total} on",
  noMatch: "No area matches “{query}”.",
  section: {
    general: "General",
    people: "People & organisation",
    time: "Time & attendance",
    requests: "Requests & leave",
    pay: "Pay",
    other: "Other",
  },
  level: {
    none: "No access",
    view: "View",
    manage: "Manage",
  },
  extra: {
    approve: "Approve",
    set_pay: "Choose paid days",
  },
  // One row per area of the system: its name and what access to it means.
  area: {
    dashboard: { name: "Overview page", hint: "The company dashboard with today's numbers." },
    company: { name: "Company settings", hint: "Company profile, plan and modules." },
    audit: { name: "Activity log", hint: "Who changed what, when and where — only in branches they can see." },
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
    requests: { name: "Requests", hint: "View: send own leave/requests. Manage: approve for others. Choose paid days: pay or not pay leave days when approving." },
    leave_policies: { name: "Leave policy", hint: "Leave types and balances." },
    salary: { name: "Salaries", hint: "Each employee's pay, tax details and allowances." },
    payroll: { name: "Payroll", hint: "Manage: prepare pay runs, settings, adjustments. Approve: sign runs off." },
  },

  // ── Footer ───────────────────────────────────────────────────────
  allPermissions: "All permissions",
  permissionCount: "{n} of {total} permissions",
  create: "Create role",
  updated: "Role updated",
  created: "Role created",
};
