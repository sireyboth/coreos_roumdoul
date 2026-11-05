"use client";

import { Badge } from "@/components/ui/badge";
import { COLOR_STYLE, StatusChip } from "@/components/dashboard/shared/status-chip";
import { useStatusCodes } from "@/hooks/use-status-codes";
import type { AttendanceDayStatus, CalendarAttendance, DayStatus } from "@/lib/api";
import { CALENDAR_ATTENDANCE_LOOK, DAY_STATUS_LOOK } from "@/lib/attendance/status-codes";
import { useT } from "@/lib/i18n";
import { DAY_STATUS } from "@/lib/schedule";

/**
 * A day's status as words ("Absent"), in the colours the company set for it in
 * Attendance → Status codes — absent here looks like "A" in the report.
 * Statuses the report doesn't mark (not yet, in progress, no schedule) keep a
 * plain badge.
 */
/** The calendars' attendance marks (present, late…) as a dot in the company's colour for that status. */
export function useStatusDot(): (status: CalendarAttendance | DayStatus) => string {
  const codes = useStatusCodes();
  return (status) => {
    const report: DayStatus = status in CALENDAR_ATTENDANCE_LOOK ? CALENDAR_ATTENDANCE_LOOK[status as CalendarAttendance] : (status as DayStatus);
    return COLOR_STYLE[codes.statuses[report].color].dot;
  };
}

/** A calendar day's attendance mark as words ("Late"), in the company's colour for it. */
export function AttendanceMarkBadge({ attendance }: { attendance: CalendarAttendance }) {
  const t = useT();
  const codes = useStatusCodes();
  return (
    <StatusChip look={codes.statuses[CALENDAR_ATTENDANCE_LOOK[attendance]]} size="sm" className="rounded-full px-2.5 text-xs">
      {t(`calendar.shared.attendance.${attendance}`)}
    </StatusChip>
  );
}

export function DayStatusBadge({ status }: { status: AttendanceDayStatus }) {
  const t = useT();
  const codes = useStatusCodes();
  const words = t(`attendance.status.day.${status}`);
  const report = DAY_STATUS_LOOK[status];

  if (!report) return <Badge variant={DAY_STATUS[status].tone}>{words}</Badge>;
  return (
    <StatusChip look={codes.statuses[report]} size="sm" className="rounded-full px-2.5 text-xs">
      {words}
    </StatusChip>
  );
}
