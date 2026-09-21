/**
 * The link an admin shares with staff who sign in with an employee ID. It opens
 * the login page with the company already filled in, so they never type the code.
 * (Runs in the browser only, where `window` exists — call it from event handlers
 * or client components, not while the server renders.)
 */
export function companyLoginLink(companySlug: string): string {
  return `${window.location.origin}/login?company=${encodeURIComponent(companySlug)}`;
}
