"use client";

import { usePathname } from "next/navigation";

// "Liquid glass" look for the phone home screen: frosted panes over a soft,
// deep, out-of-focus scene. The page (app/dashboard/home) draws the panes; the
// dashboard layout draws the backdrop behind everything and turns its header
// and the tab bar to glass while the home screen is open.

/** True while the glass home screen is showing. */
export function useGlass(): boolean {
  return usePathname() === "/dashboard/home";
}

/**
 * One frosted pane: a light sheen fading down the glass, heavy blur that also
 * lifts the colours behind it, a light-catching rim (glass-edge, globals.css),
 * a highlight along the top and a long soft shadow underneath. Text on it is white.
 */
export const pane =
  "glass-edge bg-linear-to-b from-white/22 to-white/[0.06] backdrop-blur-2xl backdrop-saturate-150 shadow-[inset_0_1px_0_rgb(255_255_255/0.35),0_24px_48px_-24px_rgb(2_6_23/0.55)] dark:from-white/12 dark:to-white/[0.03] dark:[--glass-edge:0.45]";

/** Icon well inside a pane — a smaller, brighter piece of the same glass. */
export const well = "bg-white/15 shadow-[inset_0_1px_0_rgb(255_255_255/0.4)] dark:bg-white/8";

/**
 * A full-width glass bar (the header and the tab bar). `[&_button]` reaches the
 * outline buttons inside (bell, theme, menu) so they turn to glass too — by tag,
 * not data-slot, because a menu trigger (the bell) swaps the button's data-slot
 * for its own. Grey helper text is lifted to soft white so it stays readable.
 */
export const glassBar =
  "border-white/15 bg-white/10 text-white backdrop-blur-2xl backdrop-saturate-150 dark:bg-white/5 [&_button]:border-white/25! [&_button]:bg-white/10! [&_button]:text-white! [&_button]:shadow-none! [&_.text-muted-foreground]:text-white/70!";

/**
 * Fine film grain over the backdrop so the gradients read as a photo rather
 * than flat CSS. Tiny inline SVG noise, tiled.
 */
const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

/**
 * The scene the glass sits on: a deep blue-grey sky with blurred window light,
 * a touch of warm sun and greenery, a vignette and grain. Fixed to the screen
 * like a phone wallpaper, behind everything (-z-10), so the shell around it
 * must be transparent for it to show.
 */
export function GlassBackdrop() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-linear-to-b from-[#2c4256] via-[#48627a] to-[#647e92] dark:from-[#0e1620] dark:via-[#142130] dark:to-[#0b121a]"
    >
      <div className="absolute -top-32 -left-24 size-96 rounded-full bg-sky-200/40 blur-3xl dark:bg-sky-300/12" />
      <div className="absolute -top-16 -right-24 size-80 rounded-full bg-amber-100/25 blur-3xl dark:bg-amber-200/6" />
      <div className="absolute top-[38%] -right-28 size-104 rounded-full bg-emerald-200/25 blur-3xl dark:bg-emerald-300/8" />
      <div className="absolute top-[65%] -left-24 size-96 rounded-full bg-indigo-200/20 blur-3xl dark:bg-indigo-300/8" />
      <div className="absolute inset-0 bg-[radial-gradient(120%_80%_at_50%_30%,transparent_40%,rgb(2_6_23/0.35))]" />
      <div className="absolute inset-0 opacity-[0.09] mix-blend-overlay" style={{ backgroundImage: GRAIN }} />
    </div>
  );
}
