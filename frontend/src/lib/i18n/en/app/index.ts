// app module — the app shell, overview dashboard, sign-in and shared UI pieces.
// One file per screen; the file name is the key's middle part, e.g.
// t("app.dashboard.week.title") lives in en/app/dashboard.ts.

import { shell } from "./shell";
import { dashboard } from "./dashboard";
import { notifications } from "./notifications";
import { pushPrompt } from "./pushPrompt";
import { assistant } from "./assistant";
import { account } from "./account";
import { charts } from "./charts";
import { excelImport } from "./excelImport";
import { auth } from "./auth";
import { ui } from "./ui";

export const app = { shell, dashboard, notifications, pushPrompt, assistant, account, charts, excelImport, auth, ui };
