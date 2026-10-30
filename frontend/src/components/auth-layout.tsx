"use client";

/* eslint-disable @next/next/no-img-element -- tiny static logo, no optimisation needed */
import { CalendarCheck, Palmtree, Wallet, type LucideIcon } from "lucide-react";
import { KbachCorner, surfaceCard } from "@/components/dashboard/shared/kbach";
import { LanguageToggle } from "@/components/language-toggle";
import { useLang, useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * Shell for sign in and sign up, in the Roumdoul look of the phone home screen
 * (app/dashboard/home): the warm coffee mesh behind everything, the form on a
 * solid surface card with the kbach flower in its corner, caramel as the accent.
 * - Desktop (lg+): two columns on the mesh — logo, headline and a few sample
 *   app cards left; the form card right.
 * - Phone: logo and language on top, a short headline, then the form card.
 */
export function AuthLayout({ children }: { children: React.ReactNode }) {
  const t = useT();
  // Tight line-height suits big Latin headings but clips Khmer's stacked marks.
  const tight = useLang() === "km" ? "leading-snug" : "leading-[1.1]";
  const copyright = `© ${new Date().getFullYear()} Roumdoul · Business OS. ${t("app.auth.panel.rights")}`;

  return (
    <div className="mesh-coffee min-h-dvh text-ink" style={BRAND_THEME}>
      <div className="mx-auto grid min-h-dvh w-full max-w-6xl grid-cols-1 gap-6 px-4 pt-[calc(1rem+env(safe-area-inset-top))] pb-[calc(1rem+env(safe-area-inset-bottom))] sm:px-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,28rem)] lg:gap-16 lg:py-10">
        {/* Left on desktop, the top band on phones. */}
        <aside className="flex flex-col lg:justify-between lg:py-4">
          <div className="flex items-center justify-between gap-3">
            <Logo />
            <LanguageToggle className="lg:hidden" />
          </div>

          <div className="mt-8 lg:mt-0">
            <h2 className={cn("max-w-lg text-[28px] font-semibold tracking-tight text-balance sm:text-4xl lg:text-5xl", tight)}>
              {t("app.auth.panel.headline")}
            </h2>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-ink-muted sm:text-base lg:mt-5">{t("app.auth.panel.subheadline")}</p>
            <SampleCards />
          </div>

          <p className="hidden text-xs text-ink-muted lg:block">{copyright}</p>
        </aside>

        <main className="flex flex-col lg:justify-center">
          <div className="mb-3 hidden justify-end lg:flex">
            <LanguageToggle />
          </div>
          <div className={cn(surfaceCard, "p-6 sm:p-8")}>
            <KbachCorner />
            {children}
          </div>
          <p className="mt-6 text-center text-xs text-ink-muted lg:hidden">{copyright}</p>
        </main>
      </div>
    </div>
  );
}

/**
 * Re-points the shadcn colour tokens at the Roumdoul ones for everything inside
 * this shell, so the shared Button, Input, Label and Alert pick up caramel and
 * espresso without each form styling them by hand. Scoped here only — the rest
 * of the app keeps its own theme.
 */
const BRAND_THEME = {
  "--primary": "var(--brand)",
  "--primary-foreground": "var(--brand-foreground)",
  "--ring": "var(--brand)",
  "--foreground": "var(--ink)",
  "--muted-foreground": "var(--ink-muted)",
  "--background": "var(--surface)",
  "--border": "var(--surface-border)",
  // Ink-tinted, so field borders and the tab strip read on the cream card in light and dark alike.
  "--input": "color-mix(in srgb, var(--ink) 16%, transparent)",
  "--muted": "color-mix(in srgb, var(--ink) 6%, transparent)",
} as React.CSSProperties;

/** The Roumdoul logo on a white disc, with the product name beside it. */
function Logo() {
  return (
    <div className="flex items-center gap-3">
      <span className="flex size-11 items-center justify-center rounded-full bg-white shadow-[0_4px_12px_-2px_rgb(194_124_121/0.45)]">
        <img src="/logoroumdoul.png" alt="" className="size-[82%] object-contain" />
      </span>
      <div className="leading-tight">
        <p className="text-lg font-semibold tracking-tight">Roumdoul</p>
        <p className="text-xs text-ink-muted">Business OS</p>
      </div>
    </div>
  );
}

/**
 * Three small cards like the ones inside the app — a check-in, a payslip and a
 * leave approval — scattered with a slight tilt and a slow bob. They say what
 * the product does better than a feature list. Purely decorative (aria-hidden),
 * and desktop only: on a phone the form matters more than the picture.
 */
function SampleCards() {
  const t = useT();
  return (
    <div aria-hidden className="relative mt-12 hidden h-56 max-w-md select-none lg:block">
      <SampleCard
        className="top-0 left-0 w-64 -rotate-3"
        delay="0s"
        icon={CalendarCheck}
        tint="bg-emerald-100 text-emerald-800 dark:bg-emerald-400/20 dark:text-emerald-100"
        title={t("app.auth.panel.cards.checkedIn")}
        text="Sokha Chan · 07:58"
        badge={t("app.auth.panel.cards.onTime")}
      />
      <SampleCard
        className="top-20 right-0 w-56 rotate-2"
        delay="-2s"
        icon={Wallet}
        tint="bg-amber-100 text-amber-900 dark:bg-amber-400/25 dark:text-amber-100"
        title={t("app.auth.panel.cards.payslipReady")}
        text={t("app.auth.panel.cards.payslipPeriod")}
      />
      <SampleCard
        className="top-40 left-10 w-60 -rotate-1"
        delay="-4s"
        icon={Palmtree}
        tint="bg-[#e8eaf6] text-[#2f3a6e] dark:bg-[#8f9ce0]/22 dark:text-[#d3d9f7]"
        title={t("app.auth.panel.cards.leaveApproved")}
        text={t("app.auth.panel.cards.leaveDays")}
      />
    </div>
  );
}

function SampleCard({
  className,
  delay,
  icon: Icon,
  tint,
  title,
  text,
  badge,
}: {
  className: string;
  delay: string;
  icon: LucideIcon;
  tint: string;
  title: string;
  text: string;
  badge?: string;
}) {
  return (
    // Tilt on the outer box, bob on the inner one, so the two never overwrite each other.
    <div className={cn("absolute", className)}>
      <div
        className="flex animate-[auth-float_6s_ease-in-out_infinite] items-center gap-3 rounded-[20px] border border-surface-border bg-surface p-3 shadow-[0_1px_2px_rgb(43_27_18/0.05),0_16px_32px_-12px_rgb(43_27_18/0.3)] motion-reduce:animate-none"
        style={{ animationDelay: delay }}
      >
        <div className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl", tint)}>
          <Icon className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{title}</p>
          <p className="truncate text-xs text-ink-muted">{text}</p>
        </div>
        {badge && (
          <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-800 dark:bg-emerald-400/20 dark:text-emerald-100">
            {badge}
          </span>
        )}
      </div>
    </div>
  );
}
