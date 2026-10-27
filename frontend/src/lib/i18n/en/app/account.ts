// Account warnings: components/dashboard/account-banner.tsx (locked account, free trial)
// and components/dashboard/plan-limit-alert.tsx (plan limits).

export const account = {
  // ── Locked account ────────────────────────────────────────────────
  restrictedTitle: "Your account is restricted",
  restrictedText: "Most actions are unavailable until this is resolved.",

  // ── Free trial ────────────────────────────────────────────────────
  trialEndedTitle: "Your free trial has ended",
  trialEndedText: "Upgrade your plan to keep using Business OS. Contact support to switch to a paid plan.",
  trialEndsToday: "Your free trial ends today",
  trialEndsIn: "Your free trial ends in {n} days",
  trialEndingText: "Upgrade before it ends so your team doesn't lose access. Contact support to switch to a paid plan.",

  // ── Plan limits ───────────────────────────────────────────────────
  limitReachedTitle: "You've reached your {plan} plan limit",
  limitReachedEmployees: "You're using {used} of {limit} employees, so you can't add another one. Contact support to upgrade your plan.",
  limitReachedBranches: "You're using {used} of {limit} branches, so you can't add another one. Contact support to upgrade your plan.",
  limitNearTitle: "Almost at your {plan} plan limit",
  limitNearEmployeesOne: "You're using {used} of {limit} employees — only {left} more employee before you hit the limit. Contact support to upgrade.",
  limitNearEmployeesOther: "You're using {used} of {limit} employees — only {left} more employees before you hit the limit. Contact support to upgrade.",
  limitNearBranchesOne: "You're using {used} of {limit} branches — only {left} more branch before you hit the limit. Contact support to upgrade.",
  limitNearBranchesOther: "You're using {used} of {limit} branches — only {left} more branches before you hit the limit. Contact support to upgrade.",
};
