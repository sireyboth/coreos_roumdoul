"use client";

import { Alert } from "@/components/ui/alert";
import { useMe } from "@/contexts/me-context";
import { useT } from "@/lib/i18n";

// The messages for each resource the plan limits.
const LABELS = {
  employees: {
    reached: "app.account.limitReachedEmployees",
    nearOne: "app.account.limitNearEmployeesOne",
    nearOther: "app.account.limitNearEmployeesOther",
  },
  branches: {
    reached: "app.account.limitReachedBranches",
    nearOne: "app.account.limitNearBranchesOne",
    nearOther: "app.account.limitNearBranchesOther",
  },
} as const;

/**
 * Warns when the company is close to, or at, what its plan allows — before
 * the failed "Add" click, not after. Renders nothing when there's plenty of
 * room or the plan is unlimited.
 */
export function PlanLimitAlert({ resource }: { resource: keyof typeof LABELS }) {
  const { me } = useMe();
  const t = useT();

  const limit = resource === "employees" ? me?.plan?.max_employees : me?.plan?.max_branches;
  const used = me?.usage?.[resource];

  if (!me?.plan || limit == null || used == null) return null;

  const labels = LABELS[resource];

  if (used >= limit) {
    return (
      <Alert variant="destructive" title={t("app.account.limitReachedTitle", { plan: me.plan.name })}>
        {t(labels.reached, { used, limit })}
      </Alert>
    );
  }

  if (used / limit >= 0.8) {
    const left = limit - used;

    return (
      <Alert variant="warning" title={t("app.account.limitNearTitle", { plan: me.plan.name })}>
        {t(left === 1 ? labels.nearOne : labels.nearOther, { used, limit, left })}
      </Alert>
    );
  }

  return null;
}
