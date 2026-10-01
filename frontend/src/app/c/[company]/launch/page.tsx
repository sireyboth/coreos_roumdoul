"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { getToken } from "@/lib/api";

/**
 * The company manifest's start_url (see ../manifest/route.ts) — not a page
 * anyone links to directly. Decides, on every tap of the home-screen icon,
 * whether to skip straight to the scan screen (already signed in on this
 * device) or send the employee to this company's login page (not signed in
 * yet). A plain saved-token check is enough here: if it's stale or invalid,
 * /dashboard's own MeProvider still catches that and redirects to /login,
 * same as it always has.
 */
export default function CompanyLaunchPage() {
  const router = useRouter();
  const { company } = useParams<{ company: string }>();

  useEffect(() => {
    const slug = decodeURIComponent(company).trim().toLowerCase();
    router.replace(getToken() ? "/dashboard/scan" : `/c/${encodeURIComponent(slug)}/login`);
  }, [company, router]);

  return (
    <div className="flex h-screen items-center justify-center gap-2 text-sm text-muted-foreground">
      <Loader2 className="size-4 animate-spin text-primary" />
      Loading…
    </div>
  );
}
