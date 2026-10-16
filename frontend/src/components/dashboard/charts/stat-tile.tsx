import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type StatDelta = {
  /** This period minus the one compared with. */
  change: number;
  /** The previous value, to work out the percentage. */
  previous: number;
  /** Says what it's compared with: "vs Aug 2026". */
  vs: string;
  /** Whether a rise is good news. Costs rising is not; headcount is neutral. */
  upIs: "good" | "bad" | "neutral";
  format: (value: number) => string;
};

/**
 * A headline figure: label, value, and optionally how it moved since last time.
 * The arrow and the words carry the direction, so colour is never the only cue.
 */
export function StatTile({ label, value, hint, delta, emphasis }: { label: string; value: string; hint?: string; delta?: StatDelta | null; emphasis?: boolean }) {
  return (
    <Card className={cn(emphasis && "border-primary/30 bg-primary/5")}>
      <CardContent className="flex flex-col gap-1">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className={cn("font-semibold tracking-tight", emphasis ? "text-3xl" : "text-2xl")}>{value}</p>
        {delta ? <DeltaLine delta={delta} /> : hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}

function DeltaLine({ delta }: { delta: StatDelta }) {
  const { change, previous, vs, upIs, format } = delta;
  const flat = Math.abs(change) < 0.005;
  const pct = previous !== 0 ? Math.round((change / Math.abs(previous)) * 1000) / 10 : null;
  const good = upIs === "neutral" || flat ? null : (change > 0) === (upIs === "good");
  const Icon = flat ? Minus : change > 0 ? ArrowUpRight : ArrowDownRight;

  return (
    <p className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
      <span
        className={cn(
          "inline-flex items-center gap-0.5 font-medium",
          good === true && "text-success",
          good === false && "text-destructive",
          good === null && "text-foreground",
        )}
      >
        <Icon className="size-3.5" aria-hidden />
        {flat ? "No change" : `${change > 0 ? "+" : "−"}${format(Math.abs(change))}${pct !== null ? ` (${change > 0 ? "+" : "−"}${Math.abs(pct)}%)` : ""}`}
      </span>
      <span>{vs}</span>
    </p>
  );
}
