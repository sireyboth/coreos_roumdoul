"use client";

import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { useMe } from "@/contexts/me-context";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The messages nobody should be able to miss: the account is locked, or the
 * free trial is about to end. Sits at the top of every dashboard page.
 */
export function AccountBanner() {
  const { me, blocked } = useMe();
  // Read the clock once per mount — day-level precision is all this needs.
  const [now] = useState(() => Date.now());

  if (blocked) {
    return (
      <Alert variant="destructive" title="Your account is restricted">
        {blocked.message} Most actions are unavailable until this is resolved.
      </Alert>
    );
  }

  const company = me?.company;
  if (company?.status !== "trial" || !company.trial_ends_at) return null;

  const msLeft = new Date(company.trial_ends_at).getTime() - now;
  const daysLeft = Math.ceil(msLeft / DAY_MS);

  if (msLeft <= 0) {
    return (
      <Alert variant="destructive" title="Your free trial has ended">
        Upgrade your plan to keep using Business OS. Contact support to switch to a paid plan.
      </Alert>
    );
  }

  if (daysLeft > 7) return null;

  return (
    <Alert
      variant="warning"
      title={daysLeft <= 1 ? "Your free trial ends today" : `Your free trial ends in ${daysLeft} days`}
    >
      Upgrade before it ends so your team doesn&apos;t lose access. Contact support to switch to a paid plan.
    </Alert>
  );
}
