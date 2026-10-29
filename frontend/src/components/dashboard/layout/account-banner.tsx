"use client";

import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { useMe } from "@/contexts/me-context";
import { translate, useT, type Lang, type TKey } from "@/lib/i18n";

const DAY_MS = 24 * 60 * 60 * 1000;

// Company status codes with a label in app.shell.companyStatus; any other code shows as is.
const COMPANY_STATUSES = ["trial", "active", "suspended", "cancelled"];

/** The company's account status (trial, active…) in the chosen language. */
export function companyStatusLabel(lang: Lang, status: string): string {
  return COMPANY_STATUSES.includes(status) ? translate(lang, `app.shell.companyStatus.${status}` as TKey) : status;
}

/**
 * The messages nobody should be able to miss: the account is locked, or the
 * free trial is about to end. Sits at the top of every dashboard page.
 */
export function AccountBanner() {
  const { me, blocked } = useMe();
  const t = useT();
  // Read the clock once per mount — day-level precision is all this needs.
  const [now] = useState(() => Date.now());

  if (blocked) {
    return (
      <Alert variant="destructive" title={t("app.account.restrictedTitle")}>
        {blocked.message} {t("app.account.restrictedText")}
      </Alert>
    );
  }

  const company = me?.company;
  if (company?.status !== "trial" || !company.trial_ends_at) return null;

  const msLeft = new Date(company.trial_ends_at).getTime() - now;
  const daysLeft = Math.ceil(msLeft / DAY_MS);

  if (msLeft <= 0) {
    return (
      <Alert variant="destructive" title={t("app.account.trialEndedTitle")}>
        {t("app.account.trialEndedText")}
      </Alert>
    );
  }

  if (daysLeft > 7) return null;

  return (
    <Alert
      variant="warning"
      title={daysLeft <= 1 ? t("app.account.trialEndsToday") : t("app.account.trialEndsIn", { n: daysLeft })}
    >
      {t("app.account.trialEndingText")}
    </Alert>
  );
}
