import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen } from "lucide-react";

/*
 * Public documentation: no sign-in needed, but the address is deliberately
 * hard to stumble on, and search engines are told not to list it.
 */
export const metadata: Metadata = {
  title: "Business OS — Docs",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link href="/docs-cthh5ueij8" className="flex items-center gap-2 font-semibold">
            <BookOpen className="size-5 text-primary" />
            Business OS <span className="font-normal text-muted-foreground">Docs</span>
          </Link>
          <Link href="/login" className="text-sm text-muted-foreground hover:text-foreground">
            Sign in →
          </Link>
        </div>
      </header>
      {children}
      <footer className="border-t border-border py-6 text-center text-xs text-muted-foreground">Business OS documentation · written for HR, payroll and company admins</footer>
    </div>
  );
}
