// English strings. km.ts must have exactly the same keys — TypeScript checks it.
// {name} placeholders are filled in by t(key, { name: … }).

export const en = {
  common: {
    home: "Home",
    scan: "Scan",
    loadFailed: "Couldn't load today",
  },
  greeting: {
    morning: "Good morning",
    afternoon: "Good afternoon",
    evening: "Good evening",
  },
  home: {
    services: "Services",
    more: "More",
    language: "Language",
  },
  today: {
    badge: "Today",
    checkedIn: "Checked in",
    checkedOut: "Checked out",
    notCheckedIn: "Not checked in yet",
    noWork: "No work scheduled",
    auto: "Recorded automatically",
    next: "Next {slot} at {time}",
    allDone: "All scans done for today",
    scansDone: "{done} of {total} scans",
    worked: "Worked {time}",
    in: "IN",
    out: "OUT",
    scanAttendance: "Scan attendance",
    request: "Request",
    correction: "Correction",
  },
  team: {
    badge: "Team today",
    checkedIn: "checked in",
    late: "Late",
    corrections: "Corrections",
    overtime: "Overtime",
  },
  scanBanner: {
    title: "Instant scan",
    body: "Open the camera and check in with one tap.",
    cta: "Open scanner",
  },
  // Page names by URL — used where a page is linked from the home screen or tab bar.
  nav: {
    "/dashboard": "Overview",
    "/dashboard/home": "Home",
    "/dashboard/attendance": "Attendance",
    "/dashboard/requests": "Leave",
    "/dashboard/payroll": "Payroll",
    "/dashboard/calendar": "Calendar",
    "/dashboard/work-schedules": "Schedules",
    "/dashboard/employees": "Employees",
    "/dashboard/id-cards": "ID Cards",
    "/dashboard/profile": "Profile",
    "/dashboard/holidays": "Holidays",
    "/dashboard/branches": "Branches",
    "/dashboard/teams": "Teams",
    "/dashboard/attendance/corrections": "Corrections",
    "/dashboard/audit": "Audit Log",
  },
};

// Same shape, any wording — what km.ts has to satisfy.
type Shape<T> = { [K in keyof T]: T[K] extends string ? string : Shape<T[K]> };
export type Dictionary = Shape<typeof en>;
