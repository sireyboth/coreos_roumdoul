import type { DayColor, LeaveColor, StatusLook, TextColor } from "@/lib/api";
import { cn } from "@/lib/utils";

/*
 * One attendance status, drawn the way the company set it in Attendance →
 * Status codes: its code (or any words), background, text colour and weight.
 * Every screen uses this, so changing a look there changes it everywhere.
 * Excel and PDF use the same colours from lib/attendance/status-codes.ts.
 * Classes are written out in full so Tailwind keeps them (light and dark).
 */

/** Each background: a full day, a half day (dashed, fainter) and a dot for legends and swatches. */
export const COLOR_STYLE: Record<DayColor | LeaveColor, { cell: string; half: string; dot: string }> = {
  green: { cell: "bg-success/15 text-success", half: "border border-dashed border-success/60 bg-success/5 text-success", dot: "bg-success" },
  amber: { cell: "bg-warning/20 text-warning", half: "border border-dashed border-warning/60 bg-warning/5 text-warning", dot: "bg-warning" },
  yellow: {
    cell: "bg-yellow-400/20 text-yellow-700 dark:text-yellow-300",
    half: "border border-dashed border-yellow-500/60 bg-yellow-400/5 text-yellow-700 dark:text-yellow-300",
    dot: "bg-yellow-500",
  },
  gold: {
    cell: "bg-amber-500/30 text-amber-800 dark:text-amber-200",
    half: "border border-dashed border-amber-600/60 bg-amber-500/5 text-amber-800 dark:text-amber-200",
    dot: "bg-amber-600",
  },
  orange: {
    cell: "bg-orange-500/15 text-orange-700 dark:text-orange-300",
    half: "border border-dashed border-orange-500/60 bg-orange-500/5 text-orange-700 dark:text-orange-300",
    dot: "bg-orange-500",
  },
  red: { cell: "bg-destructive/15 text-destructive", half: "border border-dashed border-destructive/60 bg-destructive/5 text-destructive", dot: "bg-destructive" },
  blue: { cell: "bg-info/15 text-info", half: "border border-dashed border-info/60 bg-info/5 text-info", dot: "bg-info" },
  gray: { cell: "bg-muted text-foreground/70", half: "border border-dashed border-muted-foreground/50 text-foreground/70", dot: "bg-muted-foreground" },
  light: { cell: "text-muted-foreground ring-1 ring-inset ring-border", half: "border border-dashed border-border text-muted-foreground", dot: "bg-muted-foreground/40" },
  violet: {
    cell: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
    half: "border border-dashed border-violet-500/60 bg-violet-500/5 text-violet-700 dark:text-violet-300",
    dot: "bg-violet-500",
  },
  fuchsia: {
    cell: "bg-fuchsia-500/15 text-fuchsia-700 dark:text-fuchsia-300",
    half: "border border-dashed border-fuchsia-500/60 bg-fuchsia-500/5 text-fuchsia-700 dark:text-fuchsia-300",
    dot: "bg-fuchsia-500",
  },
  pink: {
    cell: "bg-pink-500/15 text-pink-700 dark:text-pink-300",
    half: "border border-dashed border-pink-500/60 bg-pink-500/5 text-pink-700 dark:text-pink-300",
    dot: "bg-pink-500",
  },
  indigo: {
    cell: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300",
    half: "border border-dashed border-indigo-500/60 bg-indigo-500/5 text-indigo-700 dark:text-indigo-300",
    dot: "bg-indigo-500",
  },
  cyan: {
    cell: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300",
    half: "border border-dashed border-cyan-500/60 bg-cyan-500/5 text-cyan-700 dark:text-cyan-300",
    dot: "bg-cyan-500",
  },
  teal: {
    cell: "bg-teal-500/15 text-teal-700 dark:text-teal-300",
    half: "border border-dashed border-teal-500/60 bg-teal-500/5 text-teal-700 dark:text-teal-300",
    dot: "bg-teal-500",
  },
  lime: {
    cell: "bg-lime-500/20 text-lime-800 dark:text-lime-300",
    half: "border border-dashed border-lime-600/60 bg-lime-500/5 text-lime-800 dark:text-lime-300",
    dot: "bg-lime-500",
  },
  slate: {
    cell: "bg-slate-500/15 text-slate-700 dark:text-slate-300",
    half: "border border-dashed border-slate-500/60 bg-slate-500/5 text-slate-700 dark:text-slate-300",
    dot: "bg-slate-500",
  },
};

/** A chosen text colour; "auto" keeps the background's own (in COLOR_STYLE). */
export const TEXT_STYLE: Record<Exclude<TextColor, "auto">, string> = {
  dark: "text-foreground",
  white: "text-white",
  red: "text-red-700 dark:text-red-400",
  green: "text-green-700 dark:text-green-400",
  blue: "text-blue-700 dark:text-blue-400",
  orange: "text-orange-700 dark:text-orange-400",
  violet: "text-violet-700 dark:text-violet-300",
  gray: "text-muted-foreground",
};

/** A swatch for each text colour in the settings page; "auto" shows as a split circle. */
export const TEXT_SWATCH: Record<TextColor, string> = {
  auto: "bg-gradient-to-br from-foreground/80 from-50% to-muted to-50%",
  dark: "bg-foreground",
  white: "bg-white ring-1 ring-inset ring-border",
  red: "bg-red-600",
  green: "bg-green-600",
  blue: "bg-blue-600",
  orange: "bg-orange-600",
  violet: "bg-violet-600",
  gray: "bg-muted-foreground",
};

/**
 * A look's classes. `half` = half-day leave (dashed); `unpaid` = leave that
 * lowers pay, red unless the company picked a text colour for it.
 */
export function statusChipClass(look: Pick<StatusLook, "color" | "text" | "bold">, { half = false, unpaid = false } = {}): string {
  const style = COLOR_STYLE[look.color];
  return cn(
    half ? style.half : style.cell,
    look.text !== "auto" ? TEXT_STYLE[look.text] : unpaid && "text-destructive dark:text-red-400",
    look.bold ? "font-semibold" : "font-normal",
  );
}

/** The status as a small chip. `children` replaces the code (e.g. a word: "Absent"). */
export function StatusChip({
  look,
  half,
  unpaid,
  size = "md",
  className,
  title,
  children,
}: {
  look: StatusLook;
  half?: boolean;
  unpaid?: boolean;
  size?: "sm" | "md";
  className?: string;
  title?: string;
  children?: React.ReactNode;
}) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex items-center justify-center rounded-md px-1 text-[11px] leading-none",
        size === "sm" ? "h-6 min-w-6" : "h-7 min-w-7",
        statusChipClass(look, { half, unpaid }),
        className,
      )}
    >
      {children ?? look.code}
    </span>
  );
}
