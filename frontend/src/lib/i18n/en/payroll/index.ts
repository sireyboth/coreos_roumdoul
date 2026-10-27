// payroll module — one file per screen; list each file here.

import { shared } from "./shared";
import { runs } from "./runs";
import { run } from "./run";
import { dashboard } from "./dashboard";
import { adjustments } from "./adjustments";
import { settings } from "./settings";
import { payslip } from "./payslip";
import { guide } from "./guide";

export const payroll = { shared, runs, run, dashboard, adjustments, settings, payslip, guide };
