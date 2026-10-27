// payrollSetup module — pay components, pay groups and an employee's Pay tab.
// One file per screen; the file name is the key's middle part,
// e.g. t("payrollSetup.payGroups.card.title") lives in en/payrollSetup/payGroups.ts.

import { componentDialog } from "./componentDialog";
import { employeePay } from "./employeePay";
import { payGroups } from "./payGroups";

export const payrollSetup = { componentDialog, employeePay, payGroups };
