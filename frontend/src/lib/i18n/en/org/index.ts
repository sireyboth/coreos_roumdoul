// org module — one file per screen; list each file here.
// e.g. t("org.branchesPage.title") lives in en/org/branchesPage.ts.

import { shared } from "./shared";
import { departmentsPage } from "./departmentsPage";
import { teamsPage } from "./teamsPage";
import { branchesPage } from "./branchesPage";
import { workLocationsPage } from "./workLocationsPage";
import { members } from "./members";

export const org = { shared, departmentsPage, teamsPage, branchesPage, workLocationsPage, members };
