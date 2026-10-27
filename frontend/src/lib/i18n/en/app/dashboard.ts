// Overview dashboard (app/dashboard/page.tsx). Greetings reuse home.greeting.

export const dashboard = {
  // ── Hero ──────────────────────────────────────────────────────────
  hero: {
    checkInOut: "Check in / out",
  },

  // ── Headline numbers ──────────────────────────────────────────────
  kpi: {
    checkedIn: "Checked in today",
    checkedInHint: "People who scanned today",
    employees: "Employees",
    employeesHint: "On your team",
    branches: "Branches",
    branchesHint: "Active locations",
    corrections: "Pending corrections",
    correctionsHint: "Waiting for review",
    overtime: "Overtime to review",
    overtimeHint: "Waiting for approval",
    modules: "Active modules",
    modulesHint: "Included in your plan",
  },

  // ── Attendance this week ──────────────────────────────────────────
  week: {
    title: "Attendance this week",
    description: "Check-in sessions recorded over the last 7 days",
    total: "total sessions",
  },

  // ── Recent check-ins ──────────────────────────────────────────────
  recent: {
    title: "Recent check-ins",
    description: "Latest attendance activity",
    viewAll: "View all",
    empty: "No attendance recorded yet.",
    late: "{n}m late",
  },

  // ── Quick access & quick actions ──────────────────────────────────
  quick: {
    accessTitle: "Quick access",
    accessDescription: "Jump straight to what you manage",
    actionsTitle: "Quick actions",
    actionsDescription: "Shortcuts to your workspace",
  },

  // ── Modules in the plan ───────────────────────────────────────────
  modules: {
    title: "Modules",
    description: "What your plan currently grants you",
    on: "On",
    off: "Off",
  },

  // ── Module names by code — t(`app.dashboard.module.${code}`) ──────
  module: {
    attendance: "Attendance",
    hr: "HR",
    payroll: "Payroll",
    pos: "POS",
    inventory: "Inventory",
    crm: "CRM",
    accounting: "Accounting",
    id_cards: "ID cards",
    birthdays: "Birthdays",
    ai_assistant: "Help assistant",
  },
};
