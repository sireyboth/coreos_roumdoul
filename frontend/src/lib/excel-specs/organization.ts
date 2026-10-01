import { api, type Branch, type Department, type Team, type WorkLocation } from "@/lib/api";
import { downloadSheet, today } from "@/lib/excel";
import { Lookup, optionLabel, RowError, STATUS_OPTIONS, yesNo, type ImportSpec } from "@/lib/excel-import";

/*
 * Excel import/export for the organisation structure: branches, departments,
 * teams and work locations. Export columns use the same headers as the import
 * template, so an exported file can be edited and uploaded straight back.
 */

// ───────────────────────────── Branches ─────────────────────────────

export async function exportBranches(): Promise<string> {
  const filename = `branches-${today()}.xlsx`;
  await downloadSheet(filename, {
    name: "Branches",
    rows: await api.branches.all(),
    columns: [
      { header: "Name", value: (b) => b.name },
      { header: "Code", value: (b) => b.code },
      { header: "Address", value: (b) => b.address },
      { header: "Latitude", value: (b) => b.latitude, type: "number" },
      { header: "Longitude", value: (b) => b.longitude, type: "number" },
      { header: "Active", value: (b) => yesNo(b.is_active) },
      { header: "Require location", value: (b) => yesNo(b.require_location) },
    ],
  });
  return filename;
}

export const branchImport: ImportSpec<{ branches: Lookup<Branch> }> = {
  noun: { one: "branch", many: "branches" },
  templateFile: "branches",
  matching: "A row whose Code (or, without a code, Name) matches an existing branch updates that branch.",
  notes: ["Latitude and longitude are needed for a new branch — copy them from Google Maps (right-click the spot)."],
  fields: [
    { key: "name", header: "Name", required: true, hint: "The branch's name.", example: "Phnom Penh HQ" },
    { key: "code", header: "Code", hint: "A short code, optional.", example: "PP-01" },
    { key: "address", header: "Address", hint: "Street address, optional.", example: "St. 271, Phnom Penh" },
    { key: "latitude", header: "Latitude", type: "number", hint: "Between -90 and 90. Required for a new branch.", example: "11.5564" },
    { key: "longitude", header: "Longitude", type: "number", hint: "Between -180 and 180. Required for a new branch.", example: "104.9282" },
    { key: "is_active", header: "Active", type: "boolean", hint: "Yes or No. New branches are active unless you say No.", example: "Yes" },
    {
      key: "require_location",
      header: "Require location",
      type: "boolean",
      hint: "Yes means a QR check-in only counts when the phone is within range.",
      example: "No",
    },
  ],
  load: async () => ({ branches: new Lookup(await api.branches.all(), [(b) => b.code, (b) => b.name], "branch") }),
  save: async (row, ctx) => {
    const existing = ctx.branches.find(row.text("code")) ?? ctx.branches.find(row.text("name"));
    const fields = row.pick("name", "code", "address", "latitude", "longitude", "is_active", "require_location") as Partial<Branch>;

    if (existing) {
      ctx.branches.put(await api.branches.update(existing.id, fields));
      return "updated";
    }

    if (!row.has("latitude") || !row.has("longitude")) {
      throw new RowError("A new branch needs a Latitude and Longitude.");
    }
    ctx.branches.add(await api.branches.create(fields));
    return "created";
  },
};

// ──────────────────────────── Departments ───────────────────────────

export async function exportDepartments(): Promise<string> {
  const filename = `departments-${today()}.xlsx`;
  await downloadSheet(filename, {
    name: "Departments",
    rows: await api.departments.all(),
    columns: [
      { header: "Name", value: (d) => d.name },
      { header: "Code", value: (d) => d.code },
      { header: "Branch", value: (d) => d.branch?.name },
      { header: "Parent department", value: (d) => d.parent?.name },
      { header: "Status", value: (d) => optionLabel(STATUS_OPTIONS, d.status) },
      { header: "Employees", value: (d) => d.members_count ?? null, type: "number" },
      { header: "Teams", value: (d) => d.teams_count ?? null, type: "number" },
    ],
  });
  return filename;
}

type DepartmentCtx = { departments: Lookup<Department>; branches: Lookup<Branch> };

export const departmentImport: ImportSpec<DepartmentCtx> = {
  noun: { one: "department", many: "departments" },
  templateFile: "departments",
  matching: "A row whose Name matches an existing department updates that department.",
  notes: ["A parent department must already exist, or appear on an earlier row of the same file."],
  fields: [
    { key: "name", header: "Name", required: true, hint: "The department's name.", example: "Finance" },
    { key: "code", header: "Code", hint: "A short code, optional.", example: "FIN" },
    { key: "branch", header: "Branch", hint: "The branch it belongs to (name or code), optional.", example: "Phnom Penh HQ" },
    { key: "parent", header: "Parent department", hint: "The department it sits under, optional.", example: "Operations" },
    { key: "status", header: "Status", options: STATUS_OPTIONS, hint: "Active or Inactive. New departments are active.", example: "Active" },
  ],
  load: async () => {
    const [departments, branches] = await Promise.all([api.departments.all(), api.branches.all()]);
    return {
      departments: new Lookup(departments, [(d) => d.name, (d) => d.code], "department"),
      branches: new Lookup(branches, [(b) => b.name, (b) => b.code], "branch"),
    };
  },
  choices: (ctx) => ({ branch: ctx.branches.names(), parent: ctx.departments.names() }),
  save: async (row, ctx) => {
    const payload: Partial<Omit<Department, "id">> = row.pick("name", "code", "status") as Partial<Department>;
    const branch = row.text("branch");
    const parent = row.text("parent");
    if (branch) payload.branch_id = ctx.branches.require(branch).id;
    if (parent) payload.parent_department_id = ctx.departments.require(parent).id;

    const existing = ctx.departments.find(row.text("name"));
    if (existing) {
      ctx.departments.put(await api.departments.update(existing.id, payload));
      return "updated";
    }
    ctx.departments.add(await api.departments.create(payload));
    return "created";
  },
};

// ─────────────────────────────── Teams ──────────────────────────────

export async function exportTeams(): Promise<string> {
  const filename = `teams-${today()}.xlsx`;
  await downloadSheet(filename, {
    name: "Teams",
    rows: await api.teams.all(),
    columns: [
      { header: "Name", value: (t) => t.name },
      { header: "Code", value: (t) => t.code },
      { header: "Department", value: (t) => t.department?.name },
      { header: "Status", value: (t) => optionLabel(STATUS_OPTIONS, t.status) },
      { header: "Employees", value: (t) => t.members_count ?? null, type: "number" },
    ],
  });
  return filename;
}

export const teamImport: ImportSpec<{ teams: Lookup<Team>; departments: Lookup<Department> }> = {
  noun: { one: "team", many: "teams" },
  templateFile: "teams",
  matching: "A row whose Name matches an existing team updates that team.",
  fields: [
    { key: "name", header: "Name", required: true, hint: "The team's name.", example: "Payroll" },
    { key: "code", header: "Code", hint: "A short code, optional.", example: "PAY" },
    { key: "department", header: "Department", hint: "The department it belongs to, optional.", example: "Finance" },
    { key: "status", header: "Status", options: STATUS_OPTIONS, hint: "Active or Inactive. New teams are active.", example: "Active" },
  ],
  load: async () => {
    const [teams, departments] = await Promise.all([api.teams.all(), api.departments.all()]);
    return {
      teams: new Lookup(teams, [(t) => t.name, (t) => t.code], "team"),
      departments: new Lookup(departments, [(d) => d.name, (d) => d.code], "department"),
    };
  },
  choices: (ctx) => ({ department: ctx.departments.names() }),
  save: async (row, ctx) => {
    const payload: Partial<Omit<Team, "id">> = row.pick("name", "code", "status") as Partial<Team>;
    const department = row.text("department");
    if (department) payload.department_id = ctx.departments.require(department).id;

    const existing = ctx.teams.find(row.text("name"));
    if (existing) {
      ctx.teams.put(await api.teams.update(existing.id, payload));
      return "updated";
    }
    ctx.teams.add(await api.teams.create(payload));
    return "created";
  },
};

// ─────────────────────────── Work locations ─────────────────────────

export async function exportWorkLocations(): Promise<string> {
  const filename = `work-locations-${today()}.xlsx`;
  await downloadSheet(filename, {
    name: "Work locations",
    rows: await api.workLocations.all(),
    columns: [
      { header: "Name", value: (l) => l.name },
      { header: "Branch", value: (l) => l.branch?.name },
      { header: "Address", value: (l) => l.address },
      { header: "Latitude", value: (l) => (l.latitude == null ? null : Number(l.latitude)), type: "number" },
      { header: "Longitude", value: (l) => (l.longitude == null ? null : Number(l.longitude)), type: "number" },
      { header: "Radius (m)", value: (l) => l.radius_meters, type: "number" },
      { header: "Require location", value: (l) => yesNo(l.require_location) },
      { header: "Active", value: (l) => yesNo(l.is_active) },
    ],
  });
  return filename;
}

export const workLocationImport: ImportSpec<{ locations: Lookup<WorkLocation> }> = {
  noun: { one: "work location", many: "work locations" },
  templateFile: "work-locations",
  matching: "A row whose Name matches an existing work location updates it.",
  notes: [
    "A branch's own check-in point is managed from the Branches page: here only its Radius and Active columns are applied.",
  ],
  fields: [
    { key: "name", header: "Name", required: true, hint: "The location's name.", example: "Client site — Toul Kork" },
    { key: "address", header: "Address", hint: "Street address, optional.", example: "St. 315, Phnom Penh" },
    { key: "latitude", header: "Latitude", type: "number", hint: "Between -90 and 90, optional.", example: "11.5833" },
    { key: "longitude", header: "Longitude", type: "number", hint: "Between -180 and 180, optional.", example: "104.9000" },
    { key: "radius_meters", header: "Radius (m)", type: "integer", hint: "How close (10–5000 metres) a GPS check-in must be.", example: "100" },
    {
      key: "require_location",
      header: "Require location",
      type: "boolean",
      hint: "Yes means a QR check-in only counts within range. Needs latitude and longitude.",
      example: "No",
    },
    { key: "is_active", header: "Active", type: "boolean", hint: "Yes or No. New locations are active.", example: "Yes" },
  ],
  load: async () => ({ locations: new Lookup(await api.workLocations.all(), [(l) => l.name], "work location") }),
  save: async (row, ctx) => {
    const existing = ctx.locations.find(row.text("name"));

    if (existing) {
      const fields =
        existing.branch_id != null
          ? row.pick("radius_meters", "is_active")
          : row.pick("name", "address", "latitude", "longitude", "radius_meters", "require_location", "is_active");
      ctx.locations.put(await api.workLocations.update(existing.id, fields as Partial<WorkLocation>));
      return "updated";
    }

    ctx.locations.add(
      await api.workLocations.create(
        row.pick("name", "address", "latitude", "longitude", "radius_meters", "require_location", "is_active") as Partial<WorkLocation>,
      ),
    );
    return "created";
  },
};
