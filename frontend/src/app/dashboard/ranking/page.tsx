"use client";

import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { RankingHero, RankingTabs, YourPlace } from "@/components/dashboard/attendance/ranking-board";
import { currentMonth } from "@/components/dashboard/schedules/calendar-shared";
import { useMe } from "@/contexts/me-context";
import { useApi } from "@/hooks/use-api";
import { api } from "@/lib/api";
import { useT } from "@/lib/i18n";

/**
 * Top employees of the month (EmployeeRanking on the server), laid out like
 * a mobile leaderboard: the hero with the month switcher and the podium,
 * your own place on a card overlapping it, then Top 10 / Everyone (managers)
 * / How it works. On a computer it stays a centered, phone-like column.
 */
export default function RankingPage() {
  const t = useT();
  const { me } = useMe();
  const [month, setMonth] = useState(currentMonth());
  const [branchId, setBranchId] = useState<number | null>(null);
  const { data, error } = useApi(() => api.attendance.ranking(month, branchId), [month, branchId]);

  // Never a future month — there's nothing to rank there yet.
  const changeMonth = (next: string) => setMonth(next > currentMonth() ? currentMonth() : next);

  return (
    <div className="p-3 sm:p-6 lg:p-8">
      <div className="mx-auto flex w-full max-w-2xl flex-col">
        <RankingHero
          title={t("attendance.ranking.title")}
          month={month}
          onMonth={changeMonth}
          branches={data?.branches ?? []}
          branchId={branchId}
          onBranch={setBranchId}
          top={data?.top ?? null}
          ranked={data?.ranked ?? null}
        />

        {/* Your own place: only for people who work here (have an employee record). */}
        {data && me?.employee ? (
          <YourPlace me={data.me} ranked={data.ranked} minDays={data.rule.min_days} />
        ) : (
          <div className="h-4" />
        )}

        <div className="mt-5 flex flex-col gap-4">
          {error && <Alert variant="destructive">{error}</Alert>}
          {!data && !error && <Skeleton className="h-64 w-full rounded-2xl" />}
          {data && <RankingTabs data={data} />}
        </div>
      </div>
    </div>
  );
}
