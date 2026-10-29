"use client";

import Link from "next/link";
import { ChevronLeft, House } from "lucide-react";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/** The big "‹ Home" pill that takes a phone back to the home screen. */
export function HomeButton({ className }: { className?: string }) {
  const t = useT();
  return (
    <Link
      href="/dashboard/home"
      className={cn(
        "flex h-10 items-center gap-1.5 rounded-full bg-primary pr-4 pl-3 text-sm font-semibold text-primary-foreground shadow-md shadow-primary/25 transition-transform active:scale-95",
        className,
      )}
    >
      <ChevronLeft className="size-4" />
      <House className="size-4" />
      {t("common.action.home")}
    </Link>
  );
}
