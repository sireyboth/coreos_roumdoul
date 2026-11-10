"use client";

import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

/*
 * Building blocks for long settings forms (payroll pay rules, work schedules):
 * a card per topic with a coloured icon and a one-line "what is this for", and
 * a yes/no row with a switch.
 */

/** A card with a coloured icon, a title, a one-line hint, and an optional thing on the right. */
export function FormSection({
  icon: Icon,
  tone,
  title,
  hint,
  aside,
  children,
}: {
  icon: LucideIcon;
  /** Tailwind gradient stops for the icon tile, e.g. "from-sky-500 to-indigo-500". */
  tone: string;
  title: string;
  hint?: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card className="gap-4 px-5 py-5">
      <div className="flex flex-wrap items-start gap-3">
        <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl bg-linear-to-br text-white shadow-sm", tone)}>
          <Icon className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold">{title}</h3>
          {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
        </div>
        {aside}
      </div>
      <div className="flex flex-col gap-4">{children}</div>
    </Card>
  );
}

/** A label, the input, and a small hint under it. */
export function FormField({ id, label, hint, children }: { id?: string; label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

/**
 * Every option visible at once as a tappable card (a radio group) — easier than
 * a dropdown when there are only 2–3. An option can carry a line of `help`.
 */
export function ChoiceCards<V extends string>({
  name,
  value,
  onChange,
  options,
  stacked = false,
}: {
  name: string;
  value: V;
  onChange: (value: V) => void;
  options: { value: V; label: string; help?: string }[];
  /** One under another, for a narrow card. */
  stacked?: boolean;
}) {
  return (
    <div role="radiogroup" className={cn("grid gap-2", !stacked && (options.length === 2 ? "sm:grid-cols-2" : "sm:grid-cols-3"))}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <label
            key={option.value}
            className={cn(
              "flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2.5 text-sm transition-colors has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
              selected ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50",
            )}
          >
            <input type="radio" name={name} value={option.value} checked={selected} onChange={() => onChange(option.value)} className="sr-only" />
            <span
              aria-hidden
              className={cn("mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border", selected ? "border-primary" : "border-muted-foreground/40")}
            >
              {selected && <span className="size-2 rounded-full bg-primary" />}
            </span>
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className={cn(selected && "font-medium")}>{option.label}</span>
              {option.help && <span className="text-xs text-muted-foreground">{option.help}</span>}
            </span>
          </label>
        );
      })}
    </div>
  );
}

/** A yes/no setting: the question (and a hint) on the left, a switch on the right. */
export function ToggleRow({
  id,
  label,
  hint,
  checked,
  onChange,
  disabled,
}: {
  id: string;
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-4 rounded-lg border border-border px-3 py-2.5", disabled && "opacity-60")}>
      <label htmlFor={id} className="min-w-0 cursor-pointer">
        <span className="block text-sm font-medium">{label}</span>
        {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
      </label>
      <Switch id={id} checked={checked} onCheckedChange={onChange} disabled={disabled} />
    </div>
  );
}
