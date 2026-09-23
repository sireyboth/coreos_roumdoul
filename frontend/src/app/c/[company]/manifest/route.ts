import { NextResponse } from "next/server";

/**
 * A manifest scoped to one company, served at /c/{slug}/manifest. The global
 * manifest (src/app/manifest.ts) has a fixed start_url — /dashboard/scan —
 * and every page links to it by default, which is exactly why a shortcut
 * added from /c/{slug}/login used to reopen at /dashboard/scan (then bounce
 * to a bare, company-less /login once MeProvider saw no saved token)
 * regardless of the URL it was installed from: an installed PWA always
 * relaunches at its manifest's start_url, not the page it was added from.
 * This route (paired with the layout above it, which points /c/[company]/*
 * pages at this manifest instead of the global one) gives each company's
 * login link its own start_url, so its shortcut reopens correctly.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ company: string }> }) {
  const { company } = await params;
  const slug = decodeURIComponent(company).trim().toLowerCase();

  return NextResponse.json(
    {
      name: `Business OS – ${slug}`,
      short_name: slug.slice(0, 12),
      description: "Business Operating System for Cambodian businesses",
      // The launcher decides between the scan screen (already signed in) and
      // this company's login page — see app/c/[company]/launch/page.tsx.
      start_url: `/c/${encodeURIComponent(slug)}/launch`,
      // Keeps this manifest's install scope inside the company subtree, so it
      // can never be confused with the global manifest's scope.
      scope: `/c/${encodeURIComponent(slug)}/`,
      display: "standalone",
      background_color: "#000000",
      theme_color: "#4f46e5",
      icons: [
        {
          src: "/icon.svg",
          sizes: "any",
          type: "image/svg+xml",
          purpose: "any",
        },
      ],
    },
    { headers: { "Content-Type": "application/manifest+json" } },
  );
}
