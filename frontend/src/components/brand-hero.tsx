"use client";

import { useId } from "react";
import { setLang, useLang, useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

// Pieces of the phone "app" look for the phone sign-in screen (components/auth-layout).

/** The brand gradient behind hero bands — the same in light and dark alike (darker in dark mode). */
export const brandGradient =
  "bg-linear-to-br from-indigo-600 via-violet-600 to-fuchsia-600 dark:from-indigo-950 dark:via-violet-950 dark:to-fuchsia-950";

/** Frosted white-on-gradient surface used by every small control on the hero and banner. */
export const glass = "bg-white/15 ring-1 ring-white/20 backdrop-blur";

/** Decorative geometry for the hero band: a dot grid plus concentric rings. */
export function HeroPattern() {
  const id = useId();
  return (
    <svg aria-hidden className="pointer-events-none absolute inset-0 size-full text-white" preserveAspectRatio="none">
      <defs>
        <pattern id={`${id}-dots`} width="18" height="18" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="1.2" fill="currentColor" opacity="0.18" />
        </pattern>
        <radialGradient id={`${id}-fade`} cx="85%" cy="10%" r="80%">
          <stop offset="0" stopColor="white" stopOpacity="1" />
          <stop offset="1" stopColor="white" stopOpacity="0" />
        </radialGradient>
        <mask id={`${id}-mask`}>
          <rect width="100%" height="100%" fill={`url(#${id}-fade)`} />
        </mask>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id}-dots)`} mask={`url(#${id}-mask)`} />
      <g fill="none" stroke="currentColor" strokeWidth="1.2">
        {[40, 80, 120, 160, 200].map((r, i) => (
          <circle key={r} cx="92%" cy="-10" r={r} opacity={0.22 - i * 0.035} />
        ))}
        {[60, 110].map((r) => (
          <circle key={r} cx="-20" cy="100%" r={r} opacity="0.1" />
        ))}
      </g>
    </svg>
  );
}

/** ខ្មែរ | EN switch on the hero band. `activeText` tints the selected option to suit the band behind it. */
export function LangSwitch({ activeText = "text-violet-700" }: { activeText?: string }) {
  const lang = useLang();
  const t = useT();
  return (
    <div role="group" aria-label={t("home.menu.language")} className={cn("flex shrink-0 rounded-full p-0.5 text-[11px] font-semibold", glass)}>
      {(["km", "en"] as const).map((value) => (
        <button
          key={value}
          type="button"
          onClick={() => setLang(value)}
          aria-pressed={lang === value}
          className={cn("rounded-full px-2.5 py-1 transition-colors", lang === value ? cn("bg-white", activeText) : "text-white/80")}
        >
          {value === "km" ? "ខ្មែរ" : "EN"}
        </button>
      ))}
    </div>
  );
}
