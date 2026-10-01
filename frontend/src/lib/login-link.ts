/**
 * The link an admin shares with staff who sign in with an employee ID. It opens
 * the login page with the company already filled in, so they never type the code.
 *
 * The company lives in the path (/c/{slug}/login), not a `?company=` query
 * string, because a path segment survives becoming a home-screen shortcut
 * the way a query string doesn't. That alone isn't enough, though: an
 * installed PWA always relaunches at its manifest's start_url, not the page
 * it was installed from — which is why /c/[company]/ has its own manifest
 * (app/c/[company]/manifest/route.ts) with a start_url baked in per company,
 * instead of relying on the app's global one (app/manifest.ts).
 *
 * (Runs in the browser only, where `window` exists — call it from event handlers
 * or client components, not while the server renders.)
 */
export function companyLoginLink(companySlug: string): string {
  return `${window.location.origin}/c/${encodeURIComponent(companySlug)}/login`;
}
