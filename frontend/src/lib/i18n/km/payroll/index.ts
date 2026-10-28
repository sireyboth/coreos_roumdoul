// ប្រាក់បៀវត្សរ៍ — Payroll module. Same files and keys as en/payroll/.

import { shared } from "./shared";
import { runs } from "./runs";
import { run } from "./run";
import { dashboard } from "./dashboard";
import { adjustments } from "./adjustments";
import { settings } from "./settings";
import { payslip } from "./payslip";
import { guide } from "./guide";
import { bankExport } from "./bankExport";

export const payroll = { shared, runs, run, dashboard, adjustments, settings, payslip, guide, bankExport };
