"use client";

import { usePathname } from "next/navigation";

// Glass theme pieces (tokens and the glass-surface / mesh-coffee / press
// utilities live in globals.css). The phone home screen draws the warm mesh
// behind everything; the floating header and tab bar are glass on every page.

/** True while the phone home screen is showing — the only page with the mesh behind it. */
export function useGlass(): boolean {
  return usePathname() === "/dashboard/home";
}

/**
 * Buttons inside the glass header (bell, theme, help, menu): plain icons on
 * the glass at a 48px touch size, round, with a faint fill when pressed.
 * Matched by tag, not data-slot, because a menu trigger (the bell) swaps the
 * button's data-slot for its own.
 */
export const headerButtons =
  "[&_button]:size-12! [&_button]:rounded-full! [&_button]:border-0! [&_button]:bg-transparent! [&_button]:text-ink! [&_button]:shadow-none! [&_button:active]:bg-ink/8! [&_button_svg]:size-5!";

/**
 * The static warm mesh the glass sits on, fixed to the screen like a phone
 * wallpaper and behind everything (-z-10) — the shell around it must be
 * transparent for it to show.
 */
export function GlassBackdrop() {
  return <div aria-hidden className="mesh-coffee pointer-events-none fixed inset-0 -z-10" />;
}
