/**
 * The link an admin shares with staff who sign in with an employee ID. It opens
 * the login page with the company already filled in, so they never type the code.
 *
 * The company lives in the path (/c/{slug}/login), not a `?company=` query
 * string: this app is a PWA with a fixed manifest start_url, so a shortcut
 * added via "Add to Home Screen" launches there and drops any query string —
 * a path segment is part of the address and survives that.
 *
 * (Runs in the browser only, where `window` exists — call it from event handlers
 * or client components, not while the server renders.)
 */
export function companyLoginLink(companySlug: string): string {
  return `${window.location.origin}/c/${encodeURIComponent(companySlug)}/login`;
}
