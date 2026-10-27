"use client";

import { Languages } from "lucide-react";
import { setLang, useLang, useT, type Lang } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const OPTIONS: { value: Lang; label: string }[] = [
  { value: "km", label: "ខ្មែរ" },
  { value: "en", label: "EN" },
];

/**
 * ខ្មែរ | EN switch for the header and sidebar. The choice is kept per device;
 * the phone home screen has its own frosted version (LangSwitch).
 * `showIcon` adds the 文A icon in front, for the sidebar where it stands alone.
 */
export function LanguageToggle({ className, showIcon = false }: { className?: string; showIcon?: boolean }) {
  const lang = useLang();
  const t = useT();

  return (
    <div
      role="group"
      aria-label={t("sidebar.language")}
      className={cn("flex h-9 shrink-0 items-center gap-0.5 rounded-lg border border-input bg-background p-0.5 text-xs font-semibold shadow-xs", className)}
    >
      {showIcon && <Languages className="mx-1.5 size-3.5 text-muted-foreground" aria-hidden />}
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => setLang(option.value)}
          aria-pressed={lang === option.value}
          className={cn(
            "h-full flex-1 rounded-md px-2.5 transition-colors",
            lang === option.value ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
