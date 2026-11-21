"use client";

import { useEffect, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { CalendarCheck, ChevronLeft, ChevronRight, Clock, Crown, ListOrdered, ShieldCheck, Timer, Trophy } from "lucide-react";
import { Confetti, CONFETTI_MS } from "@/components/dashboard/employees/birthday-celebration";
import { EmployeeAvatar } from "@/components/dashboard/employees/employee-avatar";
import { KbachCorner, KbachPattern, surfaceCard } from "@/components/dashboard/shared/kbach";
import { currentMonth, parseDate, shiftMonth } from "@/components/dashboard/schedules/calendar-shared";
import type { Ranking, RankingEntry, RankingNumbers } from "@/lib/api";
import { dateLocale, useLang, useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * Top employees, laid out like a mobile leaderboard app:
 *   hero card (month switcher + podium) → "Your place" card overlapping it →
 *   tabs: Top 10 / Everyone (managers) / How it works.
 *
 * Same look as the home screen's check-in card (shared/kbach): warm surface
 * cards, the kbach flower and damask pattern in the corner, ink text, and
 * the caramel brand colour as the one accent (podium, crown, score ring,
 * bars). Icons are lucide, never emoji.
 */

/** "Job title · Branch", leaving out what's empty. */
const role = (entry: RankingEntry) => [entry.job_title, entry.branch].filter(Boolean).join(" · ");

// Entrance animation, as on the phone home screen; off for people who prefer less motion.
const RISE = "motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-3 duration-500 ease-out";

/** A row card: the home screen's tile surface. */
const ROW = "relative isolate overflow-hidden rounded-[20px] border border-surface-border bg-surface p-3 shadow-[0_1px_2px_rgb(43_27_18/0.05)] dark:shadow-[inset_0_1px_0_rgb(255_255_255/0.06)]";

/** A small rounded tile in the brand tint (icons, rank numbers). */
const BRAND_TILE = "flex shrink-0 items-center justify-center bg-brand/10 text-brand ring-1 ring-brand/20";

// ───────────────────────────── Celebration ─────────────────────────────

/** Confetti in the brand's caramel and gold family, so it matches the page instead of a party palette. */
const BRAND_CONFETTI = ["#a3561c", "#c9853f", "#e3a462", "#d4a017", "#f0c987", "#7a3f12"];

/**
 * True for a few seconds the first time this browser sees a period's winners
 * (one month + branch), then false for good. The "seen" mark lives in
 * localStorage; if storage is blocked we simply skip the celebration.
 *
 * It starts on the next animation frame (right after the podium paints) and
 * the "seen" mark is written there too, not in the effect body: React's dev
 * double-run cancels the first frame, so marking early would skip it. The
 * second effect owns the stop timer, so the confetti always goes away.
 */
function useCelebrateOnce(periodKey: string, ready: boolean) {
  const [celebrating, setCelebrating] = useState(false);

  useEffect(() => {
    if (!ready) return;
    const key = `ranking-celebrated:${periodKey}`;
    const frame = requestAnimationFrame(() => {
      try {
        if (localStorage.getItem(key)) return;
        localStorage.setItem(key, "1");
      } catch {
        return;
      }
      setCelebrating(true);
    });
    return () => cancelAnimationFrame(frame);
  }, [periodKey, ready]);

  useEffect(() => {
    if (!celebrating) return;
    const timer = setTimeout(() => setCelebrating(false), CONFETTI_MS);
    return () => clearTimeout(timer);
  }, [celebrating]);

  return celebrating;
}

// ───────────────────────────── Hero + podium ─────────────────────────────

export function RankingHero({
  title,
  month,
  onMonth,
  branches,
  branchId,
  onBranch,
  top,
  ranked,
}: {
  title: string;
  month: string;
  onMonth: (month: string) => void;
  branches: { id: number; name: string }[];
  branchId: number | null;
  onBranch: (id: number | null) => void;
  top: RankingEntry[] | null;
  ranked: number | null;
}) {
  const t = useT();
  const lang = useLang();
  const atLatest = month >= currentMonth();
  const label = parseDate(`${month}-01`).toLocaleDateString(dateLocale(lang), { month: "long", year: "numeric" });
  // Celebrate once per month + branch, only when there is a winner to celebrate.
  const celebrating = useCelebrateOnce(`${month}:${branchId ?? "all"}`, (top?.length ?? 0) > 0);

  return (
    <section className={cn(surfaceCard, "px-4 pt-4 pb-14 text-ink sm:px-6")}>
      <KbachCorner />
      {celebrating && <Confetti colors={BRAND_CONFETTI} once />}

      <div className="flex flex-col gap-5">
        {/* Month switcher + branch. */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1 rounded-full border border-surface-border bg-ink/5 p-1">
            <MonthButton icon={ChevronLeft} label={t("common.time.previousMonth")} onClick={() => onMonth(shiftMonth(month, -1))} />
            <span className="min-w-32 px-1 text-center text-sm font-semibold">{label}</span>
            <MonthButton icon={ChevronRight} label={t("common.time.nextMonth")} onClick={() => onMonth(shiftMonth(month, 1))} disabled={atLatest} />
          </div>
          {branches.length > 1 && (
            <select
              aria-label={t("attendance.ranking.allBranches")}
              className="h-10 max-w-40 truncate rounded-full border border-surface-border bg-ink/5 px-3 text-sm font-medium outline-none"
              value={branchId ?? ""}
              onChange={(e) => onBranch(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">{t("attendance.ranking.allBranches")}</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="text-center">
          <h1 className="flex items-center justify-center gap-2 text-[26px] font-semibold tracking-tight">
            <Trophy className="size-6 text-brand" />
            {title}
          </h1>
          {ranked !== null && ranked > 0 && <p className="mt-0.5 text-sm text-ink-muted">{t("attendance.ranking.rankedCount", { n: ranked })}</p>}
        </div>

        <Podium top={top} celebrating={celebrating} />
      </div>
    </section>
  );
}

function MonthButton({ icon: Icon, label, onClick, disabled }: { icon: LucideIcon; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className="press flex size-8 items-center justify-center rounded-full transition-colors hover:bg-ink/10 disabled:opacity-30 disabled:hover:bg-transparent"
    >
      <Icon className="size-4" />
    </button>
  );
}

/** Three steps, 2 – 1 – 3, each with the person standing on it. Empty steps stay as outlines. */
function Podium({ top, celebrating }: { top: RankingEntry[] | null; celebrating: boolean }) {
  // The first three in list order, shown 2 – 1 – 3. A shared rank (two at #2)
  // still fills the next step; the step shows their real rank.
  const firstThree = top?.slice(0, 3) ?? [];
  const slots = [firstThree[1] ?? null, firstThree[0] ?? null, firstThree[2] ?? null];
  const steps = [
    { place: 2, height: "h-16", avatar: "size-14", step: "bg-brand/10" },
    { place: 1, height: "h-24", avatar: "size-20", step: "bg-brand/20" },
    { place: 3, height: "h-12", avatar: "size-14", step: "bg-brand/[0.07]" },
  ];

  return (
    <div className={cn("grid grid-cols-3 items-end gap-2 sm:gap-4", RISE)}>
      {steps.map((step, i) => {
        const entry = slots[i];
        const first = step.place === 1;
        return (
          <div key={step.place} className="flex min-w-0 flex-col items-center">
            {entry ? (
              <>
                <div className="relative mb-2">
                  {/* During the celebration: a brand halo swells out from #1, three times. */}
                  {first && celebrating && (
                    <span
                      aria-hidden
                      className="absolute inset-0 rounded-full bg-brand/40 motion-safe:animate-[winner-glow_1.4s_ease-out_3] motion-reduce:hidden"
                    />
                  )}
                  {/* The one solid accent: the crown on #1, in the brand colour. */}
                  {first && (
                    <span className="absolute -top-5 left-1/2 z-10 flex size-8 -translate-x-1/2 items-center justify-center rounded-full bg-brand text-brand-foreground shadow-md">
                      <Crown className="size-4" />
                    </span>
                  )}
                  <EmployeeAvatar
                    name={entry.name}
                    photoUrl={entry.photo_url}
                    className={cn("ring-offset-2 ring-offset-surface", first ? "ring-4 ring-brand text-xl" : "ring-2 ring-brand/40 text-base", step.avatar)}
                  />
                </div>
                <p className="w-full truncate text-center text-sm font-semibold">{entry.name}</p>
                <p className="mb-2 text-xs font-medium tabular-nums text-ink-muted">{entry.score}</p>
              </>
            ) : (
              <div className={cn("mb-2 rounded-full border-2 border-dashed border-ink/15", step.avatar)} />
            )}
            <div className={cn("relative isolate flex w-full items-start justify-center overflow-hidden rounded-t-2xl pt-2 ring-1 ring-brand/15", step.height, step.step)}>
              <KbachPattern />
              <span className={cn("font-bold text-brand", first ? "text-3xl" : "text-2xl")}>{entry?.rank ?? step.place}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ───────────────────────────── Your place ─────────────────────────────

/** The viewer's own place, overlapping the hero: a score ring, the rank, and their own numbers. */
export function YourPlace({ me, ranked, minDays }: { me: Ranking["me"]; ranked: number; minDays: number }) {
  const t = useT();

  return (
    <div className={cn(surfaceCard, "z-10 mx-3 -mt-9 p-4 shadow-lg sm:mx-6", RISE)}>
      {me ? (
        <div className="flex items-center gap-4">
          <ScoreRing score={me.score} />
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold text-ink-muted">{t("attendance.ranking.yourRank")}</p>
            <p className="text-2xl font-semibold tracking-tight">{t("attendance.ranking.rankOf", { rank: me.rank, n: ranked })}</p>
            <Numbers numbers={me} className="mt-2" />
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <span className={cn(BRAND_TILE, "size-11 rounded-[12px]")}>
            <Trophy className="size-5" />
          </span>
          <div>
            <p className="text-[13px] font-semibold text-ink-muted">{t("attendance.ranking.yourRank")}</p>
            <p className="text-sm">{t("attendance.ranking.notRankedYet", { n: minDays })}</p>
          </div>
        </div>
      )}
    </div>
  );
}

/** A circle that fills up to the score (out of 100), with the number in the middle. */
function ScoreRing({ score }: { score: number }) {
  const t = useT();
  const radius = 28;
  const length = 2 * Math.PI * radius;

  return (
    <div className="relative size-18 shrink-0">
      <svg viewBox="0 0 64 64" className="size-full -rotate-90" aria-hidden>
        <circle cx="32" cy="32" r={radius} fill="none" strokeWidth="6" className="stroke-ink/10" />
        <circle
          cx="32"
          cy="32"
          r={radius}
          fill="none"
          strokeWidth="6"
          strokeLinecap="round"
          className="stroke-brand transition-[stroke-dashoffset] duration-700"
          strokeDasharray={length}
          strokeDashoffset={length * (1 - Math.min(score, 100) / 100)}
        />
      </svg>
      <span className="absolute inset-0 flex flex-col items-center justify-center leading-none">
        <span className="text-lg font-semibold tabular-nums">{score}</span>
        <span className="text-[10px] text-ink-muted">{t("attendance.ranking.outOf")}</span>
      </span>
    </div>
  );
}

function Numbers({ numbers, className }: { numbers: RankingNumbers; className?: string }) {
  const t = useT();
  const items = [
    { icon: CalendarCheck, text: t("attendance.ranking.daysCame", { present: numbers.present_days, scheduled: numbers.scheduled_days }) },
    { icon: Clock, text: t("attendance.ranking.daysOnTime", { onTime: numbers.on_time_days, present: numbers.present_days }) },
    ...(numbers.late_minutes > 0 ? [{ icon: Timer, text: t("attendance.ranking.lateTotal", { n: numbers.late_minutes }) }] : []),
  ];

  return (
    <ul className={cn("flex flex-wrap gap-1.5 text-xs", className)}>
      {items.map((item) => (
        <li key={item.text} className="inline-flex items-center gap-1.5 rounded-full bg-ink/5 px-2.5 py-1 text-ink-muted">
          <item.icon className="size-3.5 shrink-0 text-brand" />
          {item.text}
        </li>
      ))}
    </ul>
  );
}

// ───────────────────────────── Tabs ─────────────────────────────

type Tab = "top" | "all" | "how";

/** Top 10 / Everyone (managers only) / How it works. */
export function RankingTabs({ data }: { data: Ranking }) {
  const t = useT();
  const [tab, setTab] = useState<Tab>("top");
  const tabs: { id: Tab; label: string }[] = [
    { id: "top", label: t("attendance.ranking.topTitle") },
    ...(data.all ? [{ id: "all" as const, label: t("attendance.ranking.allTitle") }] : []),
    { id: "how", label: t("attendance.ranking.tabHow") },
  ];

  return (
    <div className="flex flex-col gap-3">
      <div
        className="grid gap-1 rounded-full border border-surface-border bg-ink/5 p-1 text-sm"
        style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}
        role="tablist"
      >
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            onClick={() => setTab(item.id)}
            className={cn(
              "press truncate rounded-full px-3 py-2 font-medium transition-colors",
              tab === item.id ? "bg-brand text-brand-foreground shadow-sm" : "text-ink-muted hover:text-ink",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === "top" && <TopList entries={data.top.slice(3)} minDays={data.rule.min_days} empty={data.top.length === 0} />}
      {tab === "all" && data.all && <EveryoneList rows={data.all} />}
      {tab === "how" && <HowItWorks rule={data.rule} />}
    </div>
  );
}

/** Places 4–10, one rounded row each with a brand score bar. */
function TopList({ entries, minDays, empty }: { entries: RankingEntry[]; minDays: number; empty: boolean }) {
  const t = useT();

  if (empty) {
    return (
      <div className={cn(surfaceCard, "flex flex-col items-center gap-2 px-6 py-10 text-center")}>
        <KbachCorner />
        <span className={cn(BRAND_TILE, "size-12 rounded-2xl")}>
          <Trophy className="size-6" />
        </span>
        <p className="font-semibold">{t("attendance.ranking.emptyTitle")}</p>
        <p className="max-w-xs text-sm text-ink-muted">{t("attendance.ranking.emptyHint", { n: minDays })}</p>
      </div>
    );
  }

  return (
    <ul className={cn("flex flex-col gap-2", RISE)}>
      {entries.map((entry) => (
        <li key={entry.employee_id} className={cn(ROW, "flex items-center gap-3")}>
          <span className={cn(BRAND_TILE, "size-8 rounded-full text-sm font-semibold tabular-nums")}>{entry.rank}</span>
          <EmployeeAvatar name={entry.name} photoUrl={entry.photo_url} className="size-11" />
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2">
              <p className="truncate font-medium">{entry.name}</p>
              <p className="shrink-0 text-sm font-semibold tabular-nums">{entry.score}</p>
            </div>
            {role(entry) && <p className="truncate text-xs text-ink-muted">{role(entry)}</p>}
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-ink/10">
              <div className="h-full rounded-full bg-brand" style={{ width: `${entry.score}%` }} />
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Managers: everyone they may see, as rows with the numbers behind each score. */
function EveryoneList({ rows }: { rows: NonNullable<Ranking["all"]> }) {
  const t = useT();

  return (
    <div className="flex flex-col gap-2">
      <p className="flex items-center gap-1.5 px-1 text-xs text-ink-muted">
        <ShieldCheck className="size-3.5 shrink-0 text-brand" />
        {t("attendance.ranking.allHint")}
      </p>
      <ul className="flex flex-col gap-2">
        {rows.map((row) => (
          <li key={row.employee_id} className={cn(ROW, "flex items-start gap-3")}>
            <span className={cn(BRAND_TILE, "mt-1.5 size-8 rounded-full text-sm font-semibold tabular-nums")}>{row.rank}</span>
            <EmployeeAvatar name={row.name} photoUrl={row.photo_url} className="size-11" />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <p className="truncate font-medium">{row.name}</p>
                <p className="shrink-0 text-sm font-semibold tabular-nums">{row.score}</p>
              </div>
              {role(row) && <p className="truncate text-xs text-ink-muted">{role(row)}</p>}
              <Numbers numbers={row} className="mt-2" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The scoring rule as four friendly steps, so nobody has to guess why they're where they are. */
function HowItWorks({ rule }: { rule: Ranking["rule"] }) {
  const t = useT();
  const steps: { icon: LucideIcon; text: string }[] = [
    { icon: CalendarCheck, text: t("attendance.ranking.howAttendance", { weight: rule.attendance_weight }) },
    { icon: Clock, text: t("attendance.ranking.howOnTime", { weight: rule.on_time_weight }) },
    { icon: ShieldCheck, text: t("attendance.ranking.howFair") },
    { icon: ListOrdered, text: t("attendance.ranking.howMin", { n: rule.min_days }) },
  ];

  return (
    <ul className={cn("flex flex-col gap-2", RISE)}>
      {steps.map((step) => (
        <li key={step.text} className={cn(ROW, "flex items-start gap-3 p-4")}>
          <KbachPattern />
          <span className={cn(BRAND_TILE, "size-9 rounded-[12px]")}>
            <step.icon className="size-4" />
          </span>
          <p className="pt-1.5 text-sm">{step.text}</p>
        </li>
      ))}
    </ul>
  );
}
