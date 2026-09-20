"use client";

import { Alert } from "@/components/ui/alert";
import { useMe } from "@/contexts/me-context";

const LABELS = {
  employees: { singular: "employee", plural: "employees" },
  branches: { singular: "branch", plural: "branches" },
} as const;

/**
 * Warns when the company is close to, or at, what its plan allows — before
 * the failed "Add" click, not after. Renders nothing when there's plenty of
 * room or the plan is unlimited.
 */
export function PlanLimitAlert({ resource }: { resource: keyof typeof LABELS }) {
  const { me } = useMe();

  const limit = resource === "employees" ? me?.plan?.max_employees : me?.plan?.max_branches;
  const used = me?.usage?.[resource];

  if (!me?.plan || limit == null || used == null) return null;

  const labels = LABELS[resource];

  if (used >= limit) {
    return (
      <Alert variant="destructive" title={`You've reached your ${me.plan.name} plan limit`}>
        You&apos;re using {used} of {limit} {labels.plural}, so you can&apos;t add another one. Contact support to
        upgrade your plan.
      </Alert>
    );
  }

  if (used / limit >= 0.8) {
    const left = limit - used;

    return (
      <Alert variant="warning" title={`Almost at your ${me.plan.name} plan limit`}>
        You&apos;re using {used} of {limit} {labels.plural} — only {left} more {left === 1 ? labels.singular : labels.plural}{" "}
        before you hit the limit. Contact support to upgrade.
      </Alert>
    );
  }

  return null;
}
