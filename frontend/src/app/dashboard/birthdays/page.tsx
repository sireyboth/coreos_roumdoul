"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CalendarClock,
  CalendarHeart,
  CalendarRange,
  Cake,
  ChevronLeft,
  ChevronRight,
  Gift,
  PartyPopper,
  Search,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Skeleton } from "@/components/ui/skeleton";
import { Confetti } from "@/components/dashboard/employees/birthday-celebration";
import { EmployeeAvatar } from "@/components/dashboard/employees/employee-avatar";
import { EmptyState } from "@/components/dashboard/shared/empty-state";
import { PageHeader } from "@/components/dashboard/layout/page-header";
import { useMe } from "@/contexts/me-context";
import { api, type Birthday } from "@/lib/api";
import { dateLocale, translate, useLang, useT, type Lang } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/** How many faces the hero shows before it says "+N". */
const HERO_FACES = 4;

/** People per page in each column. */
const PAGE_SIZE = 10;

// A birthday has no year; 2000 is a leap year, so 29 February still works.
const monthName = (lang: Lang, month: number, style: "long" | "short") =>
  new Date(2000, month - 1, 1).toLocaleDateString(dateLocale(lang), { month: style });
const dayMonth = (lang: Lang, b: Birthday) =>
  new Date(2000, b.month - 1, b.day).toLocaleDateString(dateLocale(lang), { month: "short", day: "numeric" });

function whenLabel(lang: Lang, daysUntil: number): string {
  if (daysUntil === 0) return translate(lang, "common.time.today");
  if (daysUntil === 1) return translate(lang, "common.time.tomorrow");
  return translate(lang, "employees.birthdays.inDays", { n: daysUntil });
}

/** Calendar months from one "YYYY-MM-DD" to another: Nov → Dec is 1, Nov → next Nov is 12. */
function monthsBetween(from: string, to: string): number {
  const months = (iso: string) => Number(iso.slice(0, 4)) * 12 + Number(iso.slice(5, 7));
  return from ? months(to) - months(from) : 0;
}

/** "Sokha, Dara and Vanna" in the reader's language. */
const nameList = (lang: Lang, names: string[]) =>
  new Intl.ListFormat(dateLocale(lang), { style: "long", type: "conjunction" }).format(names);

/**
 * Everyone's next birthday, soonest first. A festive banner up top celebrates
 * today's people (or says who is next), then the year month by month. The
 * alerts (BirthdayNotifier) say when it's the day; this is for looking ahead.
 */
export default function BirthdaysPage() {
  const { me } = useMe();
  const t = useT();
  const canView = me?.permissions.includes("employees.view") ?? false;

  const [birthdays, setBirthdays] = useState<Birthday[] | null>(null);
  // "Today" in the company's timezone, from the server, so the columns match the alerts.
  const [todayIso, setTodayIso] = useState("");
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState("");
  const [branchId, setBranchId] = useState("");
  const [departmentId, setDepartmentId] = useState("");

  useEffect(() => {
    if (!canView) return;
    api
      .birthdays()
      .then((res) => {
        setBirthdays(res.data);
        setTodayIso(res.today);
      })
      .catch(() => setFailed(true));
  }, [canView]);

  // Filter choices come from the people on the list, so there's never an empty choice.
  // Departments follow the chosen branch.
  const branchOptions = useMemo(() => optionsOf((birthdays ?? []).map((b) => b.employee.branch)), [birthdays]);
  const departmentOptions = useMemo(
    () =>
      optionsOf(
        (birthdays ?? [])
          .filter((b) => !branchId || String(b.employee.branch?.id) === branchId)
          .map((b) => b.employee.department),
      ),
    [birthdays, branchId],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (birthdays ?? []).filter(
      (b) =>
        (!branchId || String(b.employee.branch?.id) === branchId) &&
        (!departmentId || String(b.employee.department?.id) === departmentId) &&
        (!q ||
          [b.employee.name, b.employee.employee_code, b.employee.branch?.name, b.employee.department?.name]
            .some((v) => v?.toLowerCase().includes(q))),
    );
  }, [birthdays, query, branchId, departmentId]);

  const hasFilters = query !== "" || branchId !== "" || departmentId !== "";
  function clearFilters() {
    setQuery("");
    setBranchId("");
    setDepartmentId("");
  }

  // The banner and totals ignore the search: they describe the whole company.
  const all = birthdays ?? [];
  const today = all.filter((b) => b.days_until === 0);
  const thisWeek = all.filter((b) => b.days_until > 0 && b.days_until <= 7).length;

  // Three columns by how many calendar months away the next birthday is:
  // 0 = this month, 1–3 = next 3 months, more = later. A birthday that already
  // passed this month comes round next year (12 months away), so it lands in "later".
  // The list is already soonest first, so each column is too. Today's people
  // stay in "this month", so a search still finds them.
  const columns = useMemo(() => {
    const thisMonth: Birthday[] = [];
    const next3: Birthday[] = [];
    const later: Birthday[] = [];
    for (const b of filtered) {
      const away = monthsBetween(todayIso, b.next_date);
      (away === 0 ? thisMonth : away <= 3 ? next3 : later).push(b);
    }
    return [
      { id: "this", label: t("employees.birthdays.thisMonth"), icon: CalendarHeart, tone: "from-rose-500 to-pink-500", items: thisMonth },
      { id: "next3", label: t("employees.birthdays.next3Months"), icon: CalendarClock, tone: "from-amber-400 to-orange-500", items: next3 },
      { id: "later", label: t("employees.birthdays.later"), icon: CalendarRange, tone: "from-violet-500 to-fuchsia-500", items: later },
    ];
  }, [filtered, todayIso, t]);

  if (!canView) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <Alert variant="destructive">{t("employees.shared.noPermission")}</Alert>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex w-full flex-col gap-6">
        <PageHeader
          title={t("employees.birthdays.title")}
          description={t("employees.birthdays.description")}
        />

        {failed ? (
          <Alert variant="destructive">{t("employees.birthdays.loadFailed")}</Alert>
        ) : birthdays === null ? (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-40 w-full rounded-2xl" />
            <div className="grid gap-3 sm:grid-cols-3">
              <Skeleton className="h-20 rounded-xl" />
              <Skeleton className="h-20 rounded-xl" />
              <Skeleton className="h-20 rounded-xl" />
            </div>
            <Skeleton className="h-64 w-full rounded-xl" />
          </div>
        ) : birthdays.length === 0 ? (
          <EmptyState
            icon={Cake}
            title={t("employees.birthdays.emptyTitle")}
            description={t("employees.birthdays.emptyHint")}
          />
        ) : (
          <>
            <Hero today={today} next={all.find((b) => b.days_until > 0)} />

            <div className="grid gap-3 sm:grid-cols-3">
              <Stat icon={Cake} tone="from-rose-500 to-pink-500" label={t("common.time.today")} value={today.length} />
              <Stat icon={PartyPopper} tone="from-amber-400 to-orange-500" label={t("employees.birthdays.next7Days")} value={thisWeek} />
              <Stat icon={Users} tone="from-violet-500 to-fuchsia-500" label={t("employees.birthdays.onFile")} value={birthdays.length} />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-full sm:max-w-sm">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t("employees.birthdays.search")}
                  className="pl-9"
                />
              </div>
              {branchOptions.length > 1 && (
                <SearchableSelect
                  ariaLabel={t("common.field.branch")}
                  placeholder={t("common.table.filterAll", { label: t("common.field.branch") })}
                  options={branchOptions}
                  value={branchId}
                  onChange={(value) => {
                    setBranchId(value);
                    setDepartmentId(""); // its departments may not be in the new branch
                  }}
                />
              )}
              {departmentOptions.length > 1 && (
                <SearchableSelect
                  ariaLabel={t("common.field.department")}
                  placeholder={t("common.table.filterAll", { label: t("common.field.department") })}
                  options={departmentOptions}
                  value={departmentId}
                  onChange={setDepartmentId}
                />
              )}
              {hasFilters && (
                <Button type="button" variant="ghost" size="sm" onClick={clearFilters}>
                  <X className="size-4" />
                  {t("common.table.clear")}
                </Button>
              )}
            </div>

            {filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {query.trim() ? t("employees.birthdays.noMatch", { query }) : t("common.table.noResultsHint")}
              </p>
            ) : (
              <div className="grid items-start gap-4 lg:grid-cols-3">
                {columns.map((column) => (
                  // The key changes with the filters, so each column starts again on page 1.
                  <Column key={`${column.id}|${query}|${branchId}|${departmentId}`} {...column} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/**
 * The festive banner. With birthdays today it shows their faces over falling
 * confetti; otherwise it quietly says who is next.
 */
function Hero({ today, next }: { today: Birthday[]; next?: Birthday }) {
  const t = useT();
  const lang = useLang();
  const party = today.length > 0;
  const faces = today.slice(0, HERO_FACES);
  const extra = today.length - faces.length;

  return (
    <div className="relative overflow-hidden rounded-2xl bg-linear-to-br from-rose-500 via-pink-500 to-amber-400 p-6 text-white shadow-lg shadow-rose-500/20 sm:p-8">
      {/* Same dotted pattern as the birthday card, so the two feel like one family. */}
      <svg aria-hidden className="pointer-events-none absolute inset-0 size-full">
        <defs>
          <pattern id="birthdays-hero" width="34" height="34" patternUnits="userSpaceOnUse" patternTransform="rotate(18)">
            <circle cx="5" cy="5" r="2" fill="white" fillOpacity="0.22" />
            <path d="M22 16v8M18 20h8" stroke="white" strokeOpacity="0.18" strokeWidth="1.6" strokeLinecap="round" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#birthdays-hero)" />
      </svg>
      {party && <Confetti />}
      <Gift aria-hidden className="absolute -right-4 -bottom-4 size-32 -rotate-12 text-white/15" />

      <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center">
        {party ? (
          <div className="flex -space-x-3">
            {faces.map((b) => (
              <EmployeeAvatar
                key={b.employee.id}
                name={b.employee.name}
                photoUrl={b.employee.photo_url}
                className="size-16 ring-4 ring-white/70"
              />
            ))}
            {extra > 0 && (
              <span className="flex size-16 items-center justify-center rounded-full bg-white/25 text-lg font-semibold ring-4 ring-white/70 backdrop-blur-sm">
                +{extra}
              </span>
            )}
          </div>
        ) : (
          <div className="flex size-16 shrink-0 items-center justify-center rounded-full bg-white/20 ring-4 ring-white/40 backdrop-blur-sm">
            <Cake className="size-8" />
          </div>
        )}

        <div className="min-w-0">
          <h2 className="text-2xl font-bold tracking-tight">
            {party ? t("employees.birthdays.heroToday") : t("employees.birthdays.heroNone")}
          </h2>
          <p className="mt-1 text-sm text-white/90">
            {party
              ? t("employees.birthdays.heroTodayHint", { names: nameList(lang, today.map((b) => b.employee.name)) })
              : next
                ? t("employees.birthdays.heroNext", {
                    name: next.employee.name,
                    when: whenLabel(lang, next.days_until).toLowerCase(),
                    date: dayMonth(lang, next),
                  })
                : t("employees.birthdays.heroNothingSoon")}
          </p>
        </div>
      </div>
    </div>
  );
}

/** One column (this month / next 3 months / later), 10 people per page. */
function Column({ label, icon: Icon, tone, items }: { id: string; label: string; icon: LucideIcon; tone: string; items: Birthday[] }) {
  const t = useT();
  const [page, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const start = (page - 1) * PAGE_SIZE;

  return (
    <Card className="gap-0 overflow-hidden py-0">
      <h2 className="flex items-center gap-2.5 border-b border-border px-4 py-3 text-sm font-semibold">
        <span className={cn("flex size-8 items-center justify-center rounded-lg bg-linear-to-br text-white", tone)}>
          <Icon className="size-4" />
        </span>
        {label}
        <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground tabular-nums">
          {items.length}
        </span>
      </h2>

      {items.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-muted-foreground">{t("employees.birthdays.columnEmpty")}</p>
      ) : (
        <ul className="divide-y divide-border">
          {items.slice(start, start + PAGE_SIZE).map((b) => (
            <Row key={b.employee.id} b={b} />
          ))}
        </ul>
      )}

      {/* Pager only when there's more than one page. */}
      {pageCount > 1 && (
        <div className="flex items-center justify-between gap-2 border-t border-border px-4 py-2 text-xs text-muted-foreground">
          <span className="tabular-nums">
            {t("common.table.showing", { from: start + 1, to: Math.min(start + PAGE_SIZE, items.length), total: items.length })}
          </span>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              aria-label={t("common.table.previousPage")}
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <span className="min-w-10 text-center tabular-nums">
              {page} / {pageCount}
            </span>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              aria-label={t("common.table.nextPage")}
              disabled={page >= pageCount}
              onClick={() => setPage(page + 1)}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

/** Unique {id, name} pairs (branches or departments) as sorted select options. */
function optionsOf(items: ({ id: number; name: string } | null)[]): { value: string; label: string }[] {
  const seen = new Map<number, string>();
  for (const item of items) if (item) seen.set(item.id, item.name);
  return [...seen].map(([id, name]) => ({ value: String(id), label: name })).sort((a, b) => a.label.localeCompare(b.label));
}

/** One person in a column: coloured date chip, face, name, countdown. */
function Row({ b }: { b: Birthday }) {
  const lang = useLang();
  const isToday = b.days_until === 0;
  const soon = b.days_until <= 7;

  return (
    <li className={cn("flex items-center gap-3 px-4 py-3", isToday && "bg-rose-50/70 dark:bg-rose-950/20")}>
      {/* Date chip: warm and solid when it's close, soft when it's far off. */}
      <div
        className={cn(
          "flex w-12 shrink-0 flex-col items-center rounded-xl py-1.5 leading-none",
          soon
            ? "bg-linear-to-br from-rose-500 to-amber-400 text-white shadow-sm shadow-rose-500/30"
            : "bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
        )}
      >
        <span className={cn("text-[10px] font-semibold uppercase", soon ? "text-white/85" : "opacity-70")}>
          {monthName(lang, b.month, "short")}
        </span>
        <span className="mt-0.5 text-lg font-bold">{b.day}</span>
      </div>
      <EmployeeAvatar name={b.employee.name} photoUrl={b.employee.photo_url} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{b.employee.name}</p>
        <p className="truncate text-xs text-muted-foreground">{subtitle(b)}</p>
      </div>
      <span
        title={dayMonth(lang, b)}
        className={cn(
          "inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium",
          isToday
            ? "bg-rose-500 text-white"
            : soon
              ? "bg-pink-100 text-pink-700 dark:bg-pink-950/50 dark:text-pink-300"
              : "bg-muted text-muted-foreground",
        )}
      >
        {isToday && <Gift className="size-3.5" />}
        {whenLabel(lang, b.days_until)}
      </span>
    </li>
  );
}

function subtitle(b: Birthday): string {
  return [b.employee.job_title, b.employee.department?.name, b.employee.branch?.name].filter(Boolean).join(" · ") || "—";
}

function Stat({ icon: Icon, tone, label, value }: { icon: LucideIcon; tone: string; label: string; value: number }) {
  return (
    <Card className="py-4">
      <div className="flex items-center gap-3 px-4">
        <div className={cn("flex size-11 shrink-0 items-center justify-center rounded-xl bg-linear-to-br text-white shadow-sm", tone)}>
          <Icon className="size-5" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-muted-foreground">{label}</p>
          <p className="text-2xl font-semibold tabular-nums">{value}</p>
        </div>
      </div>
    </Card>
  );
}
