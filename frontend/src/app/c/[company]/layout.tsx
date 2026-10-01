import type { Metadata } from "next";

/**
 * Points every /c/{slug}/* page at that company's own manifest (see the
 * sibling manifest/route.ts) instead of the app-wide one from the root
 * layout — this is what actually makes a home-screen shortcut added from
 * here reopen at the right place. See manifest/route.ts for why.
 */
export async function generateMetadata({ params }: { params: Promise<{ company: string }> }): Promise<Metadata> {
  const { company } = await params;
  const slug = decodeURIComponent(company).trim().toLowerCase();

  return {
    manifest: `/c/${encodeURIComponent(slug)}/manifest`,
    appleWebApp: {
      capable: true,
      statusBarStyle: "black-translucent",
      title: slug,
    },
  };
}

export default function CompanyLayout({ children }: { children: React.ReactNode }) {
  return children;
}
