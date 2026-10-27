"use client";

import { Bar, BarChart, CartesianGrid, LabelList, Line, LineChart, ReferenceLine, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { useT } from "@/lib/i18n";

/**
 * The dashboard's chart kit, on shadcn's chart wrapper around Recharts.
 * Every chart takes plain rows plus formatters, so pages never touch Recharts.
 *
 * Specs (from the data-viz guide): bars at most 24px thick with 4px rounded
 * ends, 2px lines with 8px dots, hairline grid, values in text colours (never
 * the series colour), a legend whenever there are two or more series.
 */

/** Series colours, validated for colour-blind separation in light and dark. Assign in this order, never cycled. */
export const SERIES = ["var(--viz-1)", "var(--viz-2)", "var(--viz-3)", "var(--viz-4)"] as const;

type Format = (value: number) => string;

/** A tooltip row per series: colour key, name, formatted value. */
function tooltip(format: Format, config: ChartConfig) {
  return (
    <ChartTooltipContent
      formatter={(value, name, item) => (
        <div className="flex w-full items-center gap-2">
          <span className="size-2.5 shrink-0 rounded-xs" style={{ background: item.color ?? item.payload?.fill }} />
          <span className="text-muted-foreground">{config[String(name)]?.label ?? name}</span>
          <span className="ml-auto pl-3 font-medium text-foreground tabular-nums">{format(Number(value))}</span>
        </div>
      )}
    />
  );
}

export type BarDatum = { label: string; value: number };

/**
 * Ranked horizontal bars: "what costs the most". Largest first; past `max`
 * bars the rest fold into one "Other" bar rather than a long tail.
 */
export function BarListChart({
  data,
  format,
  compact,
  valueLabel,
  color = SERIES[0],
  max = 8,
}: {
  data: BarDatum[];
  format: Format;
  compact: Format;
  valueLabel: string;
  color?: string;
  max?: number;
}) {
  const t = useT();
  const sorted = [...data].sort((a, b) => b.value - a.value);
  const rows = sorted.length > max ? [...sorted.slice(0, max - 1), { label: t("app.charts.other", { n: sorted.length - max + 1 }), value: sorted.slice(max - 1).reduce((t, d) => t + d.value, 0) }] : sorted;
  const config = { value: { label: valueLabel, color } } satisfies ChartConfig;
  const longest = Math.max(...rows.map((r) => Math.min(r.label.length, 22)));

  return (
    <ChartContainer config={config} className="aspect-auto w-full" style={{ height: rows.length * 34 + 12 }}>
      <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 64, bottom: 0, left: 0 }} barCategoryGap={8}>
        <XAxis type="number" hide domain={[0, "dataMax"]} />
        <YAxis
          type="category"
          dataKey="label"
          width={Math.max(72, longest * 7.5 + 20)}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v: string) => (v.length > 22 ? `${v.slice(0, 21)}…` : v)}
        />
        <ChartTooltip cursor={{ fill: "var(--muted)", opacity: 0.6 }} content={tooltip(format, config)} />
        <Bar dataKey="value" fill="var(--color-value)" radius={[0, 4, 4, 0]} maxBarSize={20}>
          <LabelList dataKey="value" position="right" offset={8} className="fill-foreground" fontSize={12} formatter={(v: unknown) => compact(Number(v))} />
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}

export type TrendSeries = { key: string; label: string };

/** Lines over time, on one axis. `highlight` marks the x value the page is about. */
export function TrendChart({
  data,
  xKey,
  series,
  format,
  compact,
  highlight,
  height = 260,
}: {
  data: Record<string, string | number>[];
  xKey: string;
  series: TrendSeries[];
  format: Format;
  compact: Format;
  highlight?: string;
  height?: number;
}) {
  const config = Object.fromEntries(series.map((s, i) => [s.key, { label: s.label, color: SERIES[i] }])) satisfies ChartConfig;

  return (
    <ChartContainer config={config} className="aspect-auto w-full" style={{ height }}>
      <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis dataKey={xKey} tickLine={false} axisLine={false} tickMargin={8} minTickGap={16} />
        {/* Lines compare change, not size: the axis hugs the data instead of starting at zero. */}
        <YAxis tickLine={false} axisLine={false} width={60} domain={[(min: number) => Math.max(0, min * 0.9), (max: number) => max * 1.05]} tickFormatter={(v: number) => compact(v)} />
        {highlight && <ReferenceLine x={highlight} stroke="var(--muted-foreground)" strokeOpacity={0.35} />}
        <ChartTooltip content={tooltip(format, config)} />
        <ChartLegend content={<ChartLegendContent />} />
        {series.map((s) => (
          <Line
            key={s.key}
            dataKey={s.key}
            type="monotone"
            stroke={`var(--color-${s.key})`}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            dot={{ r: 4, fill: `var(--color-${s.key})`, stroke: "var(--card)", strokeWidth: 2 }}
            activeDot={{ r: 5, stroke: "var(--card)", strokeWidth: 2 }}
          />
        ))}
      </LineChart>
    </ChartContainer>
  );
}

/** Upright columns for counts per bucket, e.g. how many people fall in each pay band. */
export function ColumnChart({ data, valueLabel, color = SERIES[0], height = 220 }: { data: BarDatum[]; valueLabel: string; color?: string; height?: number }) {
  const config = { value: { label: valueLabel, color } } satisfies ChartConfig;

  return (
    <ChartContainer config={config} className="aspect-auto w-full" style={{ height }}>
      <BarChart data={data} margin={{ top: 20, right: 4, bottom: 0, left: 4 }} barCategoryGap={2}>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} interval={0} fontSize={11} />
        <YAxis hide allowDecimals={false} />
        <ChartTooltip cursor={{ fill: "var(--muted)", opacity: 0.6 }} content={tooltip((v) => String(v), config)} />
        <Bar dataKey="value" fill="var(--color-value)" radius={[4, 4, 0, 0]} maxBarSize={24}>
          <LabelList dataKey="value" position="top" offset={6} className="fill-foreground" fontSize={12} formatter={(v: unknown) => (Number(v) ? String(v) : "")} />
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}

export type Share = { label: string; value: number; color: string };

/**
 * One whole split into parts, as a single bar with a 2px gap between parts,
 * and a legend list that carries the numbers. Reads better than a pie.
 */
export function ShareBar({ parts, format, total }: { parts: Share[]; format: Format; total: number }) {
  const shown = parts.filter((p) => p.value > 0);
  const pct = (v: number) => (total > 0 ? (v / total) * 100 : 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex h-3 w-full gap-0.5 overflow-hidden rounded-full" role="img" aria-label={shown.map((p) => `${p.label} ${Math.round(pct(p.value))}%`).join(", ")}>
        {shown.map((p) => (
          <div key={p.label} className="h-full first:rounded-l-full last:rounded-r-full" style={{ width: `${pct(p.value)}%`, background: p.color }} title={`${p.label}: ${format(p.value)}`} />
        ))}
      </div>
      <ul className="flex flex-col gap-2.5 text-sm">
        {parts.map((p) => (
          <li key={p.label} className="flex items-center gap-2">
            <span className="size-2.5 shrink-0 rounded-xs" style={{ background: p.color }} />
            <span className="text-muted-foreground">{p.label}</span>
            <span className="ml-auto font-medium tabular-nums">{format(p.value)}</span>
            <span className="w-12 text-right text-xs text-muted-foreground tabular-nums">{Math.round(pct(p.value))}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
