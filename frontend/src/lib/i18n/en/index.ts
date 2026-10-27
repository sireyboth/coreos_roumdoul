// English strings, one file per module. Each km/ file must have exactly the
// same keys — TypeScript checks it. {name} placeholders are filled in by
// t(key, { name: … }).
//
// To add a module: create en/<module>.ts and km/<module>.ts, then list it
// here and in km/index.ts.

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

export const en = {
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

// Same shape, any wording — what km/ has to satisfy.
type Shape<T> = { [K in keyof T]: T[K] extends string ? string : Shape<T[K]> };
export type Dictionary = Shape<typeof en>;
