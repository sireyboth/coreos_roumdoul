"use client";

import Link from "next/link";
import { BookOpen } from "lucide-react";
import { LanguageToggle } from "@/components/language-toggle";
import { useT } from "@/lib/i18n";

/* The docs header and footer. Client components so they follow the device's language; the layout stays a server file for its metadata. */

export function DocsHeader() {
  const t = useT();
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/docs-cthh5ueij8" className="flex items-center gap-2 font-semibold">
          <BookOpen className="size-5 text-primary" />
          Business OS <span className="font-normal text-muted-foreground">{t("docs.chrome.docs")}</span>
        </Link>
        <div className="flex items-center gap-3">
          <LanguageToggle />
          <Link href="/login" className="text-sm text-muted-foreground hover:text-foreground">
            {t("docs.chrome.signIn")}
          </Link>
        </div>
      </div>
    </header>
  );
}

export function DocsFooter() {
  const t = useT();
  return <footer className="border-t border-border py-6 text-center text-xs text-muted-foreground">{t("docs.chrome.footer")}</footer>;
}
