// app module — same files and keys as en/app/.

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
