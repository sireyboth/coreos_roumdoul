// Import from Excel, per module (lib/excel-specs/*.ts): how rows are matched,
// the tick-box options, and why a row can't be imported. Column names
// ({field}, {column}) stay as the Excel headers, which are English on purpose.
// The Excel template file itself always uses the English text.

export const excelSpecs = {
  // ── How a row is matched to an existing record ────────────────────
  matching: {
    branches: "A row whose Code (or, without a code, Name) matches an existing branch updates that branch.",
    departments: "A row whose Name matches an existing department updates that department.",
    teams: "A row whose Name matches an existing team updates that team.",
    workLocations: "A row whose Name matches an existing work location updates it.",
    adjustments: "Every row adds a new adjustment, dated {date} unless the row has its own date. Importing the same file twice adds them twice.",
    employees: "A row whose Employee ID (or, without one, Email) matches an existing employee updates that employee.",
    users: "A row whose Email matches an existing user changes that user's Role.",
    roles: "A row whose Role matches an existing role replaces that role's permissions.",
    schedules: "A row whose Name matches an existing schedule updates it — its hours are replaced by the row's.",
    assignments:
      "A row for an employee with the same From date as an existing assignment updates it. Otherwise it starts a new one: from that date it replaces the schedule they had.",
    holidays: "A row whose Date already has a holiday updates that holiday.",
    roster: "A row for an employee and date that is already on the roster changes that day's schedule, location or notes.",
    daysOff: "A day that is already marked as a day off for that employee is left as it is.",
    attendance:
      "A present row adds that day's scans as a correction request, so it is reviewed and logged like any other correction; the person's work schedule decides which scan is an IN and which an OUT. A leave row (AL, SL…) records that day as leave and needs no scans.",
  },

  // ── Options before importing ──────────────────────────────────────
  settings: {
    approveNow: "Approve imported records right away",
    approveNowHint: "Turns each row straight into attendance or approved leave. Untick to leave them as pending requests for review.",
  },

  // ── Why a row can't be imported ───────────────────────────────────
  row: {
    needEmployee: "Fill in the Employee ID or the Employee name.",
    branchNeedsLocation: "A new branch needs a Latitude and Longitude.",
    amountPositive: "Amount must be more than zero.",
    cantBeNegative: "{field} can't be negative.",
    daysOffNeedsSchedule: "Days off needs a Work schedule.",
    salaryNeedsCurrency: "A Base salary needs a Currency (USD or KHR).",
    fillSalary: "Fill in the Base salary too.",
    fillName: "Fill in Name, or First name and Last name.",
    employeeNeedsBranch: "A new employee needs a Branch.",
    partlySaved: "{name} was saved, but not all of their pay and schedule: {error}",
    userNeedsPassword: "A new user needs a Password.",
    passwordTooShort: "The password must be at least 8 characters.",
    unknownPermissionOne: "Unknown permission: {list}.",
    unknownPermissionOther: "Unknown permissions: {list}.",
    builtInRole: "\"{name}\" is a built-in role, so its permissions can't be changed.",
    notTimeRange: "{day}: \"{text}\" isn't a time range like 08:00-12:00.",
    impossibleTime: "{day}: \"{text}\" has an impossible time.",
    notWeekday: "\"{text}\" in {column} isn't a weekday.",
    invalidHours: "Not a valid list of hours.",
    invalidWeekdays: "Not a list of weekdays.",
    scheduleNeedsHours: "A new schedule needs hours on at least one weekday.",
    toBeforeFrom: "To is before From.",
    notScanTime: "\"{text}\" in Scans isn't a time like 08:00.",
    unknownStatus: "\"{text}\" in Status isn't Present or a leave type. Use Present, Absent, Off, or one of: {list}.",
    noHalfDay: "{type} can't be taken for half a day.",
    fullDayNoScans: "A full day of {type} can't have scans. Clear Scans, or add AM / PM for half a day.",
    fillScans: "Fill in the scan times, or put a leave type (e.g. AL) in Status.",
    notApproved: "Saved as a pending correction, but not approved: {error}",
    couldntApprove: "it couldn't be approved",
  },
};
