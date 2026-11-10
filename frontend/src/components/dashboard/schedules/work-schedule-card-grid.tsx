"use client";

import { AlarmClock, CalendarClock, Moon, Pencil, Timer, Trash2, UserPlus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { WorkSchedule } from "@/lib/api";
import { daysOffText, formatMinutes, slotsOn, slotsSummary, WEEK_ORDER, weekdayShort } from "@/lib/schedule";
import { useLang, useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type Props = {
  /** The current page's schedules, already searched and sorted by the DataTable. */
  schedules: WorkSchedule[];
  canManage: boolean;
  canAssign: boolean;
  canSeePeople: boolean;
  onEdit: (schedule: WorkSchedule) => void;
  onDelete: (schedule: WorkSchedule) => void;
  onAssign: (schedule: WorkSchedule) => void;
  onPeople: (schedule: WorkSchedule) => void;
};

/** Work schedules as cards: the week at a glance, the key rules as chips, and the actions. */
export function WorkScheduleCardGrid({ schedules, ...actions }: Props) {
  return (
    <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
      {schedules.map((schedule) => (
        <ScheduleCard key={schedule.id} schedule={schedule} {...actions} />
      ))}
    </ul>
  );
}

function ScheduleCard({
  schedule: s,
  canManage,
  canAssign,
  canSeePeople,
  onEdit,
  onDelete,
  onAssign,
  onPeople,
}: Omit<Props, "schedules"> & { schedule: WorkSchedule }) {
  const t = useT();
  const lang = useLang();
  // A night shift: some OUT lands on the next morning.
  const overnight = WEEK_ORDER.some((d) => slotsOn(s, d).some((slot) => slot.next_day));
  const Icon = overnight ? Moon : CalendarClock;

  return (
    <li
      className={cn(
        "flex flex-col gap-4 rounded-xl border border-border bg-card p-4 shadow-xs transition-shadow hover:shadow-md",
        !s.is_active && "opacity-70",
      )}
    >
      {/* Name, note and status. */}
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "flex size-11 shrink-0 items-center justify-center rounded-xl bg-linear-to-br text-white shadow-sm",
            !s.is_active ? "from-slate-400 to-slate-500" : overnight ? "from-indigo-500 to-violet-600" : "from-amber-500 to-orange-500",
          )}
        >
          <Icon className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{s.name}</p>
          <p className="truncate text-sm text-muted-foreground">{s.description || "—"}</p>
        </div>
        <span
          className={cn(
            "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
            s.is_active ? "bg-success/12 text-success" : "bg-muted text-muted-foreground",
          )}
        >
          <span className={cn("size-1.5 rounded-full", s.is_active ? "bg-success" : "bg-muted-foreground")} />
          {s.is_active ? t("common.status.active") : t("common.status.inactive")}
        </span>
      </div>

      <WeekBar schedule={s} />

      {/* The rules that matter most, as chips. */}
      <div className="flex flex-wrap gap-1.5 text-xs">
        <Chip icon={Timer} iconClass="text-amber-500">
          {t("schedules.form.weekTotal", { time: formatMinutes(s.weekly_minutes, lang) })}
        </Chip>
        <Chip icon={AlarmClock} iconClass="text-rose-500">
          {t("schedules.page.lateAfter", { n: s.late_grace_minutes })}
        </Chip>
        <Chip icon={Moon} iconClass={s.overtime_mode === "off" ? "text-muted-foreground" : "text-violet-500"}>
          {t(`schedules.page.overtime.${s.overtime_mode}`)}
          {s.overtime_mode !== "off" && s.overtime_requires_approval ? t("schedules.page.needsApproval") : ""}
        </Chip>
      </div>

      {/* People and actions. */}
      <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-border pt-3">
        <span className="mr-auto inline-flex items-center gap-1.5 text-sm">
          <Users className="size-4 text-muted-foreground" />
          <span className="font-semibold tabular-nums">{s.assigned_count ?? 0}</span>
          <span className="text-xs text-muted-foreground">· {t("schedules.page.offDays", { days: daysOffText(s.default_days_off, lang) })}</span>
        </span>
        {canSeePeople && (
          <Button variant="ghost" size="sm" onClick={() => onPeople(s)}>
            <Users className="size-3.5" />
            {t("schedules.page.column.people")}
          </Button>
        )}
        {canAssign && s.is_active && (
          <Button variant="outline" size="sm" onClick={() => onAssign(s)}>
            <UserPlus className="size-3.5" />
            {t("schedules.page.assign")}
          </Button>
        )}
        {canManage && (
          <Button variant="outline" size="sm" onClick={() => onEdit(s)}>
            <Pencil className="size-3.5" />
            {t("common.action.edit")}
          </Button>
        )}
        {canManage && (
          <Button variant="ghost" size="icon-sm" className="text-destructive hover:text-destructive" aria-label={t("common.action.delete")} title={t("common.action.delete")} onClick={() => onDelete(s)}>
            <Trash2 className="size-4" />
          </Button>
        )}
      </div>
    </li>
  );
}

/** The week, Monday first: a coloured block for a working day (with its start and end), a dashed one for a day off. */
function WeekBar({ schedule }: { schedule: WorkSchedule }) {
  const t = useT();
  const lang = useLang();
  return (
    <div className="grid grid-cols-7 gap-1">
      {WEEK_ORDER.map((weekday) => {
        const slots = slotsOn(schedule, weekday);
        const working = slots.length > 0;
        return (
          <div key={weekday} title={`${weekdayShort(weekday, lang)}: ${slotsSummary(slots, lang)}`} className="flex min-w-0 flex-col items-center gap-1">
            <span className="text-[11px] font-medium text-muted-foreground">{weekdayShort(weekday, lang)}</span>
            <div
              className={cn(
                "flex h-11 w-full flex-col items-center justify-center rounded-lg text-[10px] leading-tight tabular-nums",
                // Soft tint, not a solid block: seven per card, many cards — solid colour tires the eyes.
                working
                  ? "bg-amber-500/10 font-medium text-amber-800 ring-1 ring-amber-500/20 ring-inset dark:bg-amber-400/10 dark:text-amber-200/90 dark:ring-amber-400/15"
                  : "border border-dashed border-border text-muted-foreground",
              )}
            >
              {working ? (
                <>
                  <span>{slots[0].time.slice(0, 5)}</span>
                  <span className="opacity-85">{slots[slots.length - 1].time.slice(0, 5)}</span>
                </>
              ) : (
                t("schedules.page.dayOff")
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** A calm, neutral chip; only the small icon carries colour. */
function Chip({ icon: Icon, iconClass, children }: { icon: typeof Timer; iconClass: string; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/40 px-2.5 py-1 font-medium text-foreground/80">
      <Icon className={cn("size-3.5", iconClass)} />
      {children}
    </span>
  );
}
