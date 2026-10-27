// Schedules module — one file per screen; the file name is the key's middle part,
// e.g. t("schedules.page.title") lives in en/schedules/page.ts.

import { week } from "./week";
import { page } from "./page";
import { form } from "./form";
import { assign } from "./assign";
import { people } from "./people";
import { assignments } from "./assignments";
import { roster } from "./roster";
import { bulk } from "./bulk";

export const schedules = { week, page, form, assign, people, assignments, roster, bulk };
