import type { Dictionary } from "../en";
import { attendance } from "./attendance";
import { leave } from "./leave";
import { calendar } from "./calendar";
import { schedules } from "./schedules";
import { employees } from "./employees";
import { org } from "./org";
import { access } from "./access";
import { payroll } from "./payroll";
import { payrollSetup } from "./payrollSetup";
import { docs } from "./docs";
import { app } from "./app";
import { common } from "./common";
import { home } from "./home";
import { nav } from "./nav";
import { sidebar } from "./sidebar";

// Khmer strings, one file per module — same keys as en/ (a missing or extra
// key fails the build). Wording follows lib/i18n/GLOSSARY.md.

export const km: Dictionary = {
  common,
  attendance,
  leave,
  calendar,
  schedules,
  employees,
  org,
  access,
  payroll,
  payrollSetup,
  docs,
  app,
  home,
  nav,
  sidebar,
};
