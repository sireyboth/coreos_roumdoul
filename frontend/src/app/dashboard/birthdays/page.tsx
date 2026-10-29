"use client";

import { useEffect, useMemo, useState } from "react";
import { Cake, Gift, Search } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { EmployeeAvatar } from "@/components/dashboard/employees/employee-avatar";
import { EmptyState } from "@/components/dashboard/shared/empty-state";
import { PageHeader } from "@/components/dashboard/layout/page-header";
import { useMe } from "@/contexts/me-context";
import { api, type Birthday } from "@/lib/api";
import { dateLocale, translate, useLang, useT, type Lang } from "@/lib/i18n";

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

/**
 * Everyone's next birthday, soonest first: today's up top, then the rest of
 * the year month by month. The alerts (BirthdayNotifier) say when it's the
 * day; this is for looking ahead.
 */
export default function BirthdaysPage() {
  const { me } = useMe();
  const t = useT();
  const lang = useLang();
  const canView = me?.permissions.includes("employees.view") ?? false;

  const [birthdays, setBirthdays] = useState<Birthday[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!canView) return;
    api
      .birthdays()
      .then((res) => setBirthdays(res.data))
      .catch(() => setFailed(true));
  }, [canView]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!birthdays || !q) return birthdays ?? [];
    return birthdays.filter((b) =>
      [b.employee.name, b.employee.employee_code, b.employee.branch?.name, b.employee.department?.name]
        .some((v) => v?.toLowerCase().includes(q)),
    );
  }, [birthdays, query]);

  const today = filtered.filter((b) => b.days_until === 0);
  const thisWeek = filtered.filter((b) => b.days_until > 0 && b.days_until <= 7).length;

  // The list is already soonest first, so months come out starting with this one.
  const byMonth = useMemo(() => {
    const groups: { key: string; label: string; items: Birthday[] }[] = [];
    for (const b of filtered.filter((b) => b.days_until > 0)) {
      const key = b.next_date.slice(0, 7);
      const last = groups.at(-1);
      if (last?.key === key) last.items.push(b);
      else groups.push({ key, label: `${monthName(lang, Number(key.slice(5)), "long")} ${key.slice(0, 4)}`, items: [b] });
    }
    return groups;
  }, [filtered, lang]);

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
            <Skeleton className="h-24 w-full rounded-xl" />
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
            <div className="grid gap-3 sm:grid-cols-3">
              <Stat label={t("common.time.today")} value={today.length} />
              <Stat label={t("employees.birthdays.next7Days")} value={thisWeek} />
              <Stat label={t("employees.birthdays.onFile")} value={birthdays.length} />
            </div>

            <div className="relative max-w-sm">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("employees.birthdays.search")}
                className="pl-9"
              />
            </div>

            {today.length > 0 && (
              <section className="flex flex-col gap-3">
                <h2 className="text-sm font-semibold text-muted-foreground">{t("common.time.today")}</h2>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {today.map((b) => (
                    <Card key={b.employee.id} className="border-pink-200 bg-pink-50/60 dark:border-pink-900/60 dark:bg-pink-950/20">
                      <CardContent className="flex items-center gap-3">
                        <EmployeeAvatar name={b.employee.name} photoUrl={b.employee.photo_url} className="size-11" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">{b.employee.name}</p>
                          <p className="truncate text-xs text-muted-foreground">{subtitle(b)}</p>
                        </div>
                        <Gift className="size-5 shrink-0 text-pink-500" />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </section>
            )}

            {byMonth.length === 0 && today.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("employees.birthdays.noMatch", { query })}</p>
            ) : (
              byMonth.map((group) => (
                <section key={group.key} className="flex flex-col gap-3">
                  <h2 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                    {group.label}
                    <span className="font-normal">· {group.items.length}</span>
                  </h2>
                  <Card className="py-0">
                    <ul className="divide-y divide-border">
                      {group.items.map((b) => (
                        <li key={b.employee.id} className="flex items-center gap-3 px-4 py-3">
                          <div className="flex w-12 shrink-0 flex-col items-center rounded-lg border border-border py-1 leading-none">
                            <span className="text-[10px] font-medium text-muted-foreground uppercase">
                              {monthName(lang, b.month, "short")}
                            </span>
                            <span className="mt-0.5 text-lg font-semibold">{b.day}</span>
                          </div>
                          <EmployeeAvatar name={b.employee.name} photoUrl={b.employee.photo_url} />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{b.employee.name}</p>
                            <p className="truncate text-xs text-muted-foreground">{subtitle(b)}</p>
                          </div>
                          <Badge variant={b.days_until <= 7 ? "info" : "secondary"} title={dayMonth(lang, b)}>
                            {whenLabel(lang, b.days_until)}
                          </Badge>
                        </li>
                      ))}
                    </ul>
                  </Card>
                </section>
              ))
            )}
          </>
        )}
      </div>
    </div>
  );
}

function subtitle(b: Birthday): string {
  return [b.employee.job_title, b.employee.department?.name, b.employee.branch?.name].filter(Boolean).join(" · ") || "—";
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <Card className="py-4">
      <CardContent>
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      </CardContent>
    </Card>
  );
}
