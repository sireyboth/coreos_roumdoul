// Employee form fields (components/dashboard/employees/employee-form.tsx)

export const form = {
  // ── Name and contact ─────────────────────────────────────────────
  firstName: "First name",
  lastName: "Last name",
  fullName: "Full name",
  fullNameHint: "Filled in from the first and last name. Edit it if they go by something else.",
  nameKm: "Name in Khmer (optional)",
  nickname: "Nickname (optional)",
  nicknameHint: "What colleagues call them. They can change it themselves on their profile.",
  employeeId: "Employee ID",
  employeeCode: "Employee code (optional)",
  phone: "Phone (optional)",
  email: "Email (optional)",

  // ── Job ──────────────────────────────────────────────────────────
  department: "Department (optional)",
  team: "Team (optional)",
  none: "None",
  jobTitle: "Job title (optional)",
  manager: "Line manager (optional)",
  managerHint: "Approves this person's leave and other requests first. Empty = anyone who can approve requests in their branch.",
  noManager: "No line manager",
  orderExample: "director",
  employmentType: "Employment type",
  notSet: "Not set",
  hireDate: "Hire date",
  statusHint: "Suspended employees and anyone who has left can't check in.",
  lastDay: "Last working day",

  // ── Personal ─────────────────────────────────────────────────────
  gender: "Gender",
  dateOfBirth: "Date of birth",
  address: "Address",
  notesHint: "Personal details are only visible to people who can manage employees.",

  nationality: "Nationality",
  nationalityPlaceholder: "Cambodian",

  // ── Documents ────────────────────────────────────────────────────
  nationalId: "National ID card number",
  passport: "Passport number",
  passportHint: "For foreign staff, or anyone without a national ID.",
  nssf: "NSSF number",
  nssfHint: "National Social Security Fund.",
  taxId: "Tax ID",

  // ── Pay ──────────────────────────────────────────────────────────
  baseSalary: "Base salary (per month)",
  salaryViewHint: "You can see pay, but not change it.",
  salaryEditHint: "Only people with the salary permission can see this.",
  bank: "Bank",
  bankAccount: "Bank account number",

  // ── Section cards (title + one line saying what goes there) ──────
  section: {
    name: { title: "Name", hint: "How they appear everywhere in the app, on payslips and on ID cards." },
    contact: { title: "Contact", hint: "How to reach them." },
    job: { title: "Job", hint: "Where they work, their role, and their status." },
    personal: { title: "Personal", hint: "Only people who can manage employees see these." },
    documents: { title: "Documents", hint: "ID, passport, social security and tax numbers." },
    pay: { title: "Pay", hint: "Base salary and where it is paid." },
    other: { title: "Other", hint: "Notes for HR and where they appear in lists." },
  },
  missing: "{n} missing",
  complete: "Complete",
  jumpTo: "Jump to a section",
  unsaved: "You have unsaved changes",
  upToDate: "No unsaved changes",
  undo: "Undo changes",
};
