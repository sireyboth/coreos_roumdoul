// leave module — one file per screen; the file name is the key's middle part,
// e.g. t("leave.policyPage.title") lives in en/leave/policyPage.ts.

import { shared } from "./shared";
import { requestsPage } from "./requestsPage";
import { leaveDialog } from "./leaveDialog";
import { lateEarlyDialog } from "./lateEarlyDialog";
import { detail } from "./detail";
import { policyPage } from "./policyPage";

export const leave = { shared, requestsPage, leaveDialog, lateEarlyDialog, detail, policyPage };
