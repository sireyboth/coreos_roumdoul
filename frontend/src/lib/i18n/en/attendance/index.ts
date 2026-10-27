// Attendance module — one file per screen; the file name is the key's middle part,
// e.g. t("attendance.page.title") lives in en/attendance/page.ts.

import { status } from "./status";
import { page } from "./page";
import { today } from "./today";
import { scan } from "./scan";
import { add } from "./add";
import { fillMissed } from "./fillMissed";
import { missedScans } from "./missedScans";
import { day } from "./day";
import { adjust } from "./adjust";
import { corrections } from "./corrections";
import { overtime } from "./overtime";
import { report } from "./report";
import { lateDetail } from "./lateDetail";
import { monthClose } from "./monthClose";
import { exportDialog } from "./exportDialog";

export const attendance = { status, page, today, scan, add, fillMissed, missedScans, day, adjust, corrections, overtime, report, lateDetail, monthClose, exportDialog };
