"use client";

import { Boxes, CalendarCheck, ShieldCheck, Wallet } from "lucide-react";
import { glass, HeroPattern, LangSwitch } from "@/components/brand-hero";
import { LanguageToggle } from "@/components/language-toggle";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * Shell for sign in and sign up.
 * - Desktop (lg+): split screen — dark brand panel left, form right.
 * - Phone: looks like a native app sign-in — dark hero with the home screen's
 *   pattern (components/brand-hero), app icon centred, and the form in a
 *   rounded sheet pulled up over it.
 */
export function AuthLayout({ children }: { children: React.ReactNode }) {
  const t = useT();
  const features = [
    { icon: CalendarCheck, title: t("app.auth.panel.attendanceTitle"), text: t("app.auth.panel.attendanceText") },
    { icon: Wallet, title: t("app.auth.panel.payrollTitle"), text: t("app.auth.panel.payrollText") },
    { icon: ShieldCheck, title: t("app.auth.panel.securityTitle"), text: t("app.auth.panel.securityText") },
  ];
  const copyright = `© ${new Date().getFullYear()} Business OS. ${t("app.auth.panel.rights")}`;

  return (
    // grid-cols-1 (= minmax(0,1fr)) matters: a bare `grid` sizes its column to the
    // content, which can grow wider than a phone screen.
    <div className="grid min-h-dvh grid-cols-1 bg-background lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      {/* Desktop brand panel — fixed dark colours so it reads the same in light and dark mode. */}
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-zinc-950 p-12 text-zinc-100 lg:flex">
        <BrandBackdrop />
        <Brand className="relative" />

        <div className="relative max-w-md">
          <h2 className="text-3xl leading-tight font-semibold tracking-tight text-white">{t("app.auth.panel.headline")}</h2>
          <p className="mt-4 text-sm leading-relaxed text-zinc-400">{t("app.auth.panel.subheadline")}</p>
          <ul className="mt-10 flex flex-col gap-6">
            {features.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex gap-4">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5">
                  <Icon className="size-4 text-zinc-200" aria-hidden />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">{title}</p>
                  <p className="mt-0.5 text-sm text-zinc-400">{text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-zinc-500">{copyright}</p>
      </aside>

      <div className="flex min-w-0 flex-col">
        {/* Phone hero. Language switch sits here, before signing in, so someone new can pick a language first.
            Top padding includes the notch (safe area) for when it runs as an installed app. */}
        {/* Neutral dark on purpose — the sign-in screen stays formal, not colourful. */}
        <header className="relative overflow-hidden bg-zinc-950 px-5 pt-[calc(1rem+env(safe-area-inset-top))] pb-16 text-white lg:hidden">
          <HeroPattern />
          <div className="relative flex justify-end">
            <LangSwitch activeText="text-zinc-900" />
          </div>
          <div className="relative mt-3 flex flex-col items-center text-center">
            <div className={cn("flex size-16 items-center justify-center rounded-2xl shadow-lg shadow-black/30", glass)}>
              <Boxes className="size-8" />
            </div>
            <p className="mt-3 text-xl font-semibold tracking-tight">Business OS</p>
            <p className="mt-1 max-w-xs text-sm leading-relaxed text-white/80">{t("app.auth.panel.headline")}</p>
          </div>
        </header>

        {/* Form: a rounded sheet pulled up over the hero on phones, a plain centred column on desktop. */}
        <main className="relative -mt-8 flex flex-1 flex-col rounded-t-[2rem] bg-background px-5 pt-8 pb-[calc(1.5rem+env(safe-area-inset-bottom))] shadow-[0_-12px_32px_-12px_rgb(0_0_0/0.3)] sm:px-8 dark:border-t lg:mt-0 lg:rounded-none lg:py-6 lg:shadow-none dark:lg:border-t-0">
          <div className="hidden justify-end lg:flex">
            <LanguageToggle />
          </div>
          <div className="flex flex-1 justify-center lg:items-center lg:py-10">
            <div className="w-full max-w-sm">{children}</div>
          </div>
          <p className="mt-8 text-center text-xs text-muted-foreground lg:hidden">{copyright}</p>
        </main>
      </div>
    </div>
  );
}

// Soft primary glow + faint grid, behind the dark desktop brand panel.
function BrandBackdrop() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0"
      style={{
        backgroundImage:
          "radial-gradient(circle at 0% 0%, rgb(255 255 255 / 0.08), transparent 60%), linear-gradient(to right, rgb(255 255 255 / 0.04) 1px, transparent 1px), linear-gradient(to bottom, rgb(255 255 255 / 0.04) 1px, transparent 1px)",
        backgroundSize: "100% 100%, 40px 40px, 40px 40px",
      }}
    />
  );
}

function Brand({ className }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2.5 ${className ?? ""}`}>
      <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
        <Boxes className="size-5" />
      </div>
      <span className="text-lg font-semibold tracking-tight">Business OS</span>
    </div>
  );
}
