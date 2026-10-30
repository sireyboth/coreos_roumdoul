// Employee form fields (components/dashboard/employees/employee-form.tsx)

export const form = {
  // ── Basic info ───────────────────────────────────────────────────
  basic: "Basic info",
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

  // ── Work ─────────────────────────────────────────────────────────
  work: "Work",
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
  personal: "Personal",
  gender: "Gender",
  dateOfBirth: "Date of birth",
  address: "Address",
  notesHint: "Personal details are only visible to people who can manage employees.",

  // ── Identity documents ───────────────────────────────────────────
  identity: "Identity documents",
  nationality: "Nationality",
  nationalityPlaceholder: "Cambodian",
  nationalId: "National ID card number",
  passport: "Passport number",
  passportHint: "For foreign staff, or anyone without a national ID.",

  // ── Payroll & compliance ─────────────────────────────────────────
  compliance: "Payroll & compliance",
  nssf: "NSSF number",
  nssfHint: "National Social Security Fund.",
  taxId: "Tax ID",

  // ── Salary ───────────────────────────────────────────────────────
  salary: "Salary",
  baseSalary: "Base salary (per month)",
  salaryViewHint: "You can see pay, but not change it.",
  salaryEditHint: "Only people with the salary permission can see this.",
  bank: "Bank",
  bankAccount: "Bank account number",
};
