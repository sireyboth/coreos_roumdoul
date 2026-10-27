import type { Metadata } from "next";
import { DocsFooter, DocsHeader } from "@/components/docs/docs-chrome";

/*
 * Public documentation: no sign-in needed, but the address is deliberately
 * hard to stumble on, and search engines are told not to list it.
 * The tab title stays English: it is rendered on the server, which can't see
 * the language chosen on the device.
 */
export const metadata: Metadata = {
  title: "Business OS — Docs",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <DocsHeader />
      {children}
      <DocsFooter />
    </div>
  );
}
