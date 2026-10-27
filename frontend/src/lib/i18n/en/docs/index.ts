// docs module — the public help pages (app/docs-cthh5ueij8/). One file per page or part;
// e.g. t("docs.home.title") lives in en/docs/home.ts. Long prose may hold <b>, <i> and
// <path> marks, rendered by rich() in components/docs/doc-parts.tsx.

import { chrome } from "./chrome";
import { home } from "./home";
import { payroll } from "./payroll";
import { payrollRun } from "./payrollRun";
import { payrollMath } from "./payrollMath";

export const docs = { chrome, home, payroll, payrollRun, payrollMath };
