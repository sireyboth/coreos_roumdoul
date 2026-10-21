# CoreOS Roumdoul — User Guide

How to use CoreOS Roumdoul (shown on screen as "Business OS"). Menu names and button labels are in quotes, exactly as on screen.

## Overview

An HR system for companies in Cambodia: staff records, work schedules, attendance scanning, leave and requests, holidays and payroll.

Sidebar groups (you only see what your role allows):

- **Overview**: "Dashboard".
- **Time & Attendance**: "Attendance", "Leave & Requests", "Calendar", "Work Schedules", "Holidays", "Leave Policy".
- **Payroll**: "Pay Runs", "Adjustments", "Payroll Settings".
- **Organization**: "Employees", "Departments", "Teams", "Branches", "Work Locations", "ID Cards".
- **Access**: "Users", "Roles", "Audit Log".

Some areas depend on your plan: Attendance, Leave & Requests and Leave Policy need the attendance module; the Payroll group needs the payroll module; ID Cards needs the ID cards module. The "Help" button (this help assistant) needs the help assistant module and a paid plan; it isn't available during the free trial. The "Modules" list in the sidebar shows which are on (green dot) or locked. If a menu item is missing, your role doesn't include it or your plan doesn't have that module.

Your profile is opened from your avatar or name card. "Sign out" is the icon next to your name at the bottom of the sidebar. The sun/moon icon switches light and dark mode.

**Signing up**: on "Create your company" enter Company name, Your name, Email and Password (at least 8 characters). This starts a free 14-day trial and makes you the company-admin. A banner warns when the trial is ending; contact support to switch to a paid plan.

**Signing in**: the "Sign in" page has two tabs. "Email" uses email and password. "Employee ID" uses the "Company code" (your manager can tell you this), your "Employee ID" and password. Employee IDs and company codes ignore upper/lower case. A company sign-in link (with "Copy link" on the employee's page) fills in the company code for you. There is no "Forgot password" option: ask your admin if you are locked out. After too many failed attempts, wait a minute.

**Phone app**: on a phone, use your browser's "Add to Home Screen" on your company link or on instant-scan mode. The icon opens straight to the scanner.

## Roles

Every company starts with three roles. An admin can change them or add new ones in "Roles".

- **company-admin**: everything, including payroll, salaries, users, roles, leave policy and the audit log. Its permissions can't be changed and it can't be deleted, so nobody gets locked out.
- **manager**: Dashboard; views branches, departments and work locations; manages teams, employees, work schedules, rosters, holidays, attendance, and leave and requests. No payroll, salaries, leave policy, users, roles or audit log.
- **employee**: their own attendance, their own calendar ("My month"), holidays, the employee list of their branch (without personal or pay details), and their own leave and requests. No Dashboard or Work Schedules.

**Branch access**: someone limited to certain branches only sees and acts on employees in those branches. A new employee login is limited to that employee's branch.

**Payroll rights** come in three parts, so they can go to different people: "Salaries" (each employee's pay, tax details and allowances), "Payroll" Manage (prepare pay runs, settings, adjustments) and Payroll "Approve" (approve or reopen pay runs).

## Company setup

### Branches and work locations

**Branches** (Organization → "Branches"; changes need branch manage rights, admins by default). Click "Add branch", enter "Name", optional "Code" and "Address", and the location: "Use my current location" or type Latitude and Longitude (required). Tick "Require location when scanning the QR code" if staff must be at the branch for a scan to count; leave it off for indoor branches with no GPS signal.

Each branch automatically gets its check-in point (default radius 100 m) with a QR code. Row button "QR code" → "Download QR" to print the poster for the entrance. "Regenerate" makes a new code; the old poster stops working immediately.

A branch can't be deleted while employees are still assigned to it (including people who have left); move them first or untick "Active". "Add branch" is disabled when your plan's branch limit is reached.

**Work Locations** are extra check-in points not tied to a branch, e.g. a client site. "Add a work location": Name, Address, coordinates, "Radius (meters)" (10–5000) and "Require location when scanning the QR code". For a branch's own location you can only change Radius, Active and Display order. A location used by upcoming roster days can't be deleted.

### Departments and teams

"Departments" (Organization → Departments): "Add department" with Name, optional Code, "Part of" (to place it inside another department) and Branch (or company-wide). "Teams" are smaller groups, usually inside a department.

"Members" on a row shows who is in it; "Add people" moves people in (they leave their old department or team; history is kept). Adding someone to a team also puts them in its department. Inactive departments and teams can't take new people. You can't delete one that still has people, teams or sub-departments; set it to inactive instead.

### Employees

Organization → "Employees". Viewing needs employee view rights; adding and editing needs manage rights (admins and managers). The page has "People" and "Roster" tabs.

**Add an employee**: "Add employee" (you need at least one branch first). Only name and "Branch" are required. Other fields: Name in Khmer, "Employee code", phone, email, department, team, "Job title", "Line manager" (approves this person's requests first), "Employment type", "Hire date", "Status", personal details, identity documents, "Payroll & compliance" (NSSF number, Tax ID, Bank, Bank account number) and, with salary rights, "Base salary (per month)" and currency. Personal details are only visible to people who can manage employees.

To give them a login at the same time, fill in the "Sign-in" card: choose "Email" or "Employee ID" and a "Temporary password". Leave the password empty to add them without a login. Later, use "Create login" on their page or in the list.

**Photo**: "Upload photo", then drag and "Zoom" to crop. JPG, PNG or WebP, up to 8 MB.

**Status**: Active, Probation, On leave, Suspended, Resigned, Terminated, Contract ended, Retired. Suspended people and anyone who has left can't check in. A "left" status does not deactivate their login (do that in "Users"), and they still count toward the plan's employee limit.

**Delete** removes the person with their attendance, schedules and login for good. If someone only left, set their status to Terminated instead. You can't delete your own record. Select several rows for "Delete N".

**Excel import**: "Import" → "Download template", fill it in (blue headers are required), upload it, check the preview, then "Import N employees". Up to 1,000 rows. A row whose Employee ID (or Email) matches an existing employee updates them. Blank cells leave details unchanged. Imported employees don't get a login. "Export" downloads the list.

The employee's page has tabs "Profile", "Schedule" and (with salary rights) "Pay", plus "Export attendance" for managers and an "ID card" box.

**ID Cards** (Organization → "ID Cards"): "View" previews a printable badge with photo, employee ID, join date and a QR code that opens the employee's record; "Print" downloads the PDF.

### Users and roles

**Users** (Access → "Users"): "Invite user" creates an email login with a role. Change someone's role from the dropdown on their row (takes effect immediately). Row actions: "Branch access" (leave everything unticked for all branches), "Deactivate" / "Activate", and "Remove" (removes the login, keeps the employee record). You can't do these to yourself. Employee-ID logins are created from Employees, not here. Users can't edit someone else's name, email or password.

**Roles** (Access → "Roles"): "Create role", name it, optionally start from a "Quick start" template (Employee, Supervisor, HR office, Payroll approver, Full access), then set each area to "No access", "View" or "Manage". Payroll also has an "Approve" switch. Changes apply immediately to everyone with that role. A role still assigned to someone can't be deleted.

### Work schedules

Time & Attendance → "Work Schedules" (admins and managers). A schedule says when people should scan in and out each weekday: one stretch (08:00–17:00) or several (08:00–12:00 and 13:00–17:00).

**Create**: "New schedule" → "Name" → set "Hours" per weekday ("Add hours", "Add a stretch (e.g. after lunch)", "Copy Monday to every working day"). A time earlier than the one before is the next morning (night shifts). Then:

- "Automatic attendance — no scanning needed": for staff who don't scan; IN and OUT are recorded at the scheduled times.
- "Late after (min)" (default 5), "Early leave allowance (min)", "Unpaid break (min)" (only on days with one stretch).
- "Suggested weekly days off" (default Sunday).
- "Overtime": "Don't count overtime" (default), "Time after the last OUT" or "Hours above the schedule"; plus "Ignore overtime shorter than (min)", "Round overtime down to" and "A manager must approve it before it counts" (on by default).
- "Create schedule".

Work on a day off or a holiday counts in full as overtime, only if the schedule has overtime on. Editing a schedule changes future days only. Untick "Active" to stop new assignments. A schedule can't be deleted while anyone follows it or upcoming roster days use it.

**Overtime-only schedule**: a schedule with no hours on any day and overtime on. Every hour worked under it is overtime (holiday overtime on a holiday). Use it as a one-day roster change, not as someone's usual schedule. It can only be created in the dialog, not by import.

**Assign**: row "Assign" (or employee → "Schedule" tab → "Assign a schedule"), pick employees, "Starts on", optionally "Temporary — afterwards they go back to their usual schedule" with "Ends on", check "Weekly days off", then "Assign to N people" (up to 500). It replaces their schedule from the start date and re-checks past days. Anyone skipped is listed under "Not assigned" with the reason. "End today" on the Schedule tab stops a current schedule.

"Import assignments"/"Export assignments" handle who follows what by Excel.

### Holidays

Time & Attendance → "Holidays". Everyone can view and export; admins and managers can change them. On a holiday nobody is expected: no late marks or absences, and no leave is used.

- "Add holiday": Name, Date, "Repeats every year".
- "Import Cambodian holidays": pick "Year" and "Names in", then "Import N holidays". Dates already added are skipped. Imported holidays are one-off, and Sunday substitute days are not included; add those yourself.

**Overtime on holidays** — there is no single switch that applies overtime to all holidays. Overtime rates are set in Payroll Settings → Overtime component. To have people work on holidays:

1. Create an Overtime-only schedule (see above).
2. Employees → "Roster" → "Add to roster": pick the people and that schedule, set From/To to the holiday date(s), "Add N roster days".

All their hours then count as holiday overtime and nobody is marked late or absent. Careful: with an overtime-only schedule, every ticked weekday in the date range gets the entry ("Skip public holidays" disappears), so keep the range to the holidays themselves. To run a normal work day on a holiday, roster a normal schedule instead: late and absence then apply, and extra time is holiday overtime.

### Leave policy

Time & Attendance → "Leave Policy" (company-admin by default). It starts from Cambodian Labour Law; have your HR or legal advisor confirm it.

Default types: Annual leave (18 days a year earned monthly, +1 day per 3 years, usable after 12 months), Sick leave (no limit, document always needed), Special leave (7 a year), Maternity leave (90 calendar days, 50% pay, women only), Paternity leave (men only), Unpaid leave.

"Add leave type" or click a row to edit: "Pay (%)", "Days counted" (working days or every calendar day), "Days allowed per year" (empty = no limit), "How they are given" (all at the start of the year, or earned month by month), seniority extra days, "Usable after (months of service)", "Most days per request", "Document needed from (days)", "Notice (days ahead)", "Who can take it", "Allow half days" and "Active". The code can't be changed later.

**Late arrival / Early leave** card: "Staff can ask for it", whether excused time is paid or unpaid, and "Most per person per month" (default 3).

**Adjust a balance**: choose a person and year, enter "Days" (e.g. +2 or -1, whole or half days) and a "Reason", then "Adjust". Balances run per calendar year: earned + adjustments − approved − waiting.

### Payroll settings

Payroll → "Payroll Settings" (Payroll Manage). "Start from a preset": "Office standard" or "Factory standard" sets the daily rate, lateness, early leave, absence and overtime rules; allowances stay.

"How pay is worked out" (then "Save settings"; applies at the next calculation):

- "Daily rate": salary ÷ a fixed number of days (default 26), ÷ days in the month, or ÷ the person's scheduled work days.
- "Hours in a work day" (default 8).
- "A day with a missing scan": "Must be fixed before approving (recommended)", "Counts as worked" or "Counts as absent".
- "Fallback exchange rate (KHR per USD)": used only when the official monthly rate isn't published.
- "Round riel net pay to" (default nearest 100 ៛).
- "Pay daily-paid staff for public holidays" (on).
- "Hold overtime to the Labor Law minimums (150% on work days, 200% on days off and holidays)" (on). Turning it off allows any rate; the company is then responsible.

Tax on salary and NSSF rates are set by law and kept up to date by the platform.

**Pay groups**: "Add group" → "Name", "Paid" ("Once a month", "Twice a month", "Every week", "Every 2 weeks" or "Dates picked each time", max 62 days), optional automatic preparation of runs, and "Default group" (anyone not in a group). A group can have its own settings and rules. Its schedule can't change while it has runs in Draft or In review; it can only be deleted if nobody was ever in it and it has no runs.

**Pay components** are payslip lines. Built-in: Base salary, Overtime (Work day / Day off / Public holiday %, default 150/200/200), Attendance bonus (off until set), Absence, Unpaid leave, Late arrival, Early leave, Unpaid permission. Built-ins can be switched off, not deleted. Late arrival and Early leave can be charged "Per minute", "Fixed amount each time", "Every few times = one day", "Tiers by minutes" or "Not charged". "Add component" for your own: "Name on payslip", "Type" (Earning, Deduction, After-tax deduction; can't change later), "Amount comes from" (an amount set on each employee, or an attendance rule), tax and NSSF ticks, "Active". "Try it on an employee" previews a rule without saving.

## Every day (employees)

### Scanning in and out

Open "Attendance". The "Today" card shows your schedule, what's next ("Next: IN at 08:00") and each scan's result.

1. Tap "Scan QR" and point the camera at the QR poster at your branch, or tap "Use GPS instead" when you're at the location.
2. You never choose IN or OUT: your schedule decides. A message confirms, e.g. "IN recorded at 08:07 (expected 08:00) — 7 min late."

"Open instant-scan mode →" opens a full-screen camera; add it to your home screen for one-tap scanning. Staff on an automatic schedule don't scan.

Common messages:
- "You don't have a work schedule for today" — ask your manager to assign one.
- "This is the … code. You're assigned to …" — you can only scan at your own branch, company-wide locations, or the location on your roster for that day.
- "You're too far from …" — move inside the location's radius, or turn on location.
- "You already scanned at …" — scans within 2 minutes count once.
- "… is locked for payroll" or "already paid" — that day can't change; ask an admin.

### My attendance and corrections

"Attendance" → "Records" shows your days: check in, check out, worked time and status (Complete, Incomplete, Absent, Worked day off and so on). A banner lists your recent days missing a scan.

To fix a missed scan: "Corrections" tab → "Request correction" → "Date", only the times you forgot under "Scans you missed", a "Reason", then "Submit request". Your manager approves it, and you get a notification. You can cancel your own pending request.

"Report" shows your month, and "Export" downloads it.

### Leave and late/early requests

"Leave & Requests" → "New request".

**Leave**: choose "Type of leave", "From"/"To" (or "Morning"/"Afternoon" for a half day if the type allows), an optional reason and a document if needed (PDF or photo, up to 10 MB). The preview shows the working days it takes and your balance after. Only working days count; holidays and days off inside the dates are free. Click "Send request".

**Late arrival / Early leave**: choose "Arrive late" or "Leave early", the date, the time, and a reason. Once approved you won't be marked late or early for it, but extra lateness still counts. There's a monthly limit (default 3).

Your balances show on "My requests". Requests go to your line manager, or to an approver for your branch. You can cancel a request while it's waiting, or after approval if it hasn't started yet. Requests can't be sent for a locked or paid month.

### Calendar, profile and notifications

"Calendar" → "My month" shows work days and times, holidays, days off, leave and how each day went, with the Khmer lunar date and Sil days. "Agenda" lists just the days something happens. Your one-off shifts are on Employees → "Roster".

"Profile": change your name and email under "Account details", and your password under "Change password" (needs your current password).

The bell shows notifications (requests, approvals, birthdays). "Turn on notifications on this device" enables phone alerts. On iPhone, first "Add to Home Screen" and open the app from the icon.

## Every day (managers and HR)

### Dashboard

"Dashboard" shows today's check-ins, employees, pending corrections, overtime to review, this week's attendance and recent check-ins.

### Attendance records

"Attendance" → "Records" shows everyone in your branches. Filter by status, problem, employee or dates. "Details" on a row shows expected vs actual scans, each scan's method and location on a map, and any admin changes.

- **Adjust scans** (in Details): change a time, remove a wrong scan or "Add a scan", give a "Reason", "Save adjustment". Old scans are kept with your reason.
- **Add attendance** (header): record a day with no scans, e.g. work on a day off. Employee, date, scan times, reason. Saved right away.
- **Missed scans** (header): lists this month's days with missing scans. Check the times (defaults are the scheduled times), enter a "Reason", then "Save" or "Save all".
- **Fill missed scans** (bulk): select rows → "Fill missed scans" → "Scheduled times" or "Set times", reason, "Fill N scans". Up to 500 days.
- **Delete** (single or bulk, up to 200): removes all scans for the day for good; use it only for test data. Use Adjust scans to fix real records.
- **Import**: Excel rows become corrections or leave; "Approve imported records right away" is on by default.

### Overtime and corrections

"Overtime" tab: "Waiting", "Approved", "Rejected". Click "Approve" or "Reject". Only approved overtime is paid. If a day changes later, its overtime goes back to waiting.

"Corrections" tab: "Review" a pending request, then "Approve" (adds the scans and recalculates the day) or "Reject" (a remark is required). Nobody can approve their own correction.

### Approving requests

"Leave & Requests" → "Waiting for me" → "Review" → "Approve" or "Reject" (a remark is needed to reject). Line managers decide their team's requests; anyone who manages requests for the branch can also step in. Nobody decides their own request. "All requests" shows every request in your branches.

To record leave for someone else (e.g. a sick call), use "New request", pick them under "For" and tick "Approve it now". When HR or an admin records it, a document (e.g. a medical certificate) is optional; staff asking for themselves still need it. Approvers can cancel any request with a remark. "Delete" removes a request completely and is meant for test data.

**Wrong leave type** (e.g. asked as Annual leave, really Sick leave): open the request and click "Change type" next to its name, pick the right type, add a remark if you like, then "Save type". Works on waiting and approved leave, not in a locked payroll month. The same dates are checked again for the new type; approved leave moves its days to the new type's balance and attendance is recalculated. The employee is told, and the request shows "Changed from …". Whoever can approve the request (or, once approved, cancel it) can change it; nobody can change their own.

**Paid days**: when reviewing leave, people with "Choose paid days" (company admins by default; add it to a role under Roles → Requests) see a "Paid days" box with a tick for each day. Untick or tick days before "Approve" — e.g. pay 2 of 3 days of unpaid leave. Attendance still shows the leave type as asked; payroll pays only the ticked days; the leave balance doesn't change. It can only be set while approving, never in a locked payroll month. To change it later, cancel the request and record it again.

### Report and export

"Attendance" → "Report": a month or date range, with tiles for late rate, absence rate, missed scans and leave days, and a calendar grid (P present, L late, I incomplete, A absent, W worked day off, LV leave, H holiday, OFF). "Late detail" ranks lateness and absences.

"Export" → "Excel workbook" (choose columns, optional Calendar and Charts sheets) or "PDF report". Every employee gets a row for every date in the range, including leave, holidays and missed days. Up to 366 days.

### Team calendar and days off

"Calendar" → "Team" shows everyone's month, with today's scheduled, present, late, absent and off counts. "Individual" shows one person. "Agenda" lists holidays, leave, days off and absences.

**Mark a day off**: click the day → optional reason → "Mark as day off". Not on holidays, leave days, roster days or locked months. "Remove this day off" undoes it.

### Roster (one-off shift changes)

Employees → "Roster". A roster entry makes someone follow another schedule on a given day. It overrides holidays.

"Add to roster": pick "Employees", "Work schedule", optional "Work location", "Dates" (quick buttons or From/To), "Days of the week", "Skip public holidays" (on by default), then "Add N roster days". Limits: 93 days, 100 employees and 3,000 entries at once. Existing entries aren't overwritten.

### Audit Log

Access → "Audit Log" (company-admin): who changed what, when and from where, limited to your branches. Filter by date, person, branch, area or action; click a row for before/after values.

## Month end

### Close the attendance month

"Attendance" → "Report" in Month mode, for a finished month. The checklist shows missing scans, waiting corrections, waiting overtime and absences without leave, each with a fix button. Click "Close month".

A closed month is frozen for the whole company: no scans, corrections, adjustments, overtime review, days off, roster or schedule changes, and no leave or late/early requests in it. Overtime still waiting when you close won't be paid ("Close anyway"). "Reopen" unlocks it.

### Pay runs

Payroll → "Pay Runs". Status: "Draft" → "In review" → "Approved" → "Paid". The "Getting started with payroll" card lists the first steps.

1. "New pay run" → "Pay group" and "Period" → "Calculate pay". A period that isn't over yet is only a preview.
2. Review: totals (USD and KHR shown separately), and each payslip's "Check" ("OK", "Note", "Needs fixing", "Changed"). Click a row to see how each line was worked out. If something changes, click "Recalculate now". "Fix before approving" warnings must be solved first, e.g. missing scans or a missing exchange rate.
3. "Approve" (Payroll Approve): pay is recalculated one last time, frozen, and the attendance it used is locked.
4. Pay staff, then "Mark as paid" (Payroll Manage).

"Reopen" (Payroll Approve, reason required) sends an approved or paid run back to review and unlocks its attendance. "Delete pay run" works only before approval. "Dashboard" shows charts and "Before paying" checks such as missing bank details. "Export": "Payroll report (PDF)", "Report with payment list (PDF)" or "Spreadsheet (CSV)". The PDFs open in the print window; choose "Save as PDF".

### Adjustments

Payroll → "Adjustments": one-off amounts such as a bonus, penalty or advance. "Add adjustment" → "Apply to" (one employee, a branch or everyone), "Type", "Amount", "Date", "Name on payslip", reason → "Add". It goes into the pay run whose period holds the date; recalculate that run. It can't be dated in an approved or paid period. "Import from Excel" adds many; importing the same file twice adds them twice.

## Payroll notes

**Employee "Pay" tab** (Salaries rights): "Change group"; "Set salary"/"Change salary" with amount, USD or KHR, "Per month" or "Per day worked", "From" and reason (every change is kept); "Allowances and deductions"; and "Tax, NSSF and payment" (tax resident, NSSF enrolled, dependents, "Paid by" bank or cash). Someone without a salary is left out of pay runs. Salary and group changes can't be dated on or before the day they are already paid through; use an adjustment instead.

**How pay is calculated**:
- Per period: a full month's salary once a month, half twice a month, 12/52 weekly, 12/26 every two weeks. Joiners and leavers are paid by days.
- Daily-paid staff: days worked, plus holidays (if that setting is on) and paid leave.
- Only approved overtime is paid; overtime still waiting shows as a note.
- Absence, unpaid leave, lateness, early leave and unpaid permission come from attendance.
- Gross = earnings − deductions. Net = gross − employee NSSF − tax − after-tax deductions. Cost to company = gross + employer NSSF.
- Tax and NSSF are worked out in riel with the official monthly rate (or your fallback), and only for periods from the 1st to the last day of a month.

**Locks**: an approved or paid run freezes those people's attendance for those days. Fix later problems with an adjustment, or ask a payroll approver to reopen. A closed attendance month does not stop pay runs. Employees can't see their own payslips in the app.
