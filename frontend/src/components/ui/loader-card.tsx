/* eslint-disable @next/next/no-img-element -- tiny static logo, no optimisation needed */
import { cn } from "@/lib/utils";

// The rose of the Roumdoul logo; every ring and glow takes it via currentColor.
const LOGO_ROSE = "#c27c79";

/** Masks a conic gradient down to a ring `width` thick along the outer edge. */
const ring = (width: string) => {
  const mask = `radial-gradient(farthest-side, transparent calc(100% - ${width}), #000 calc(100% - ${width}))`;
  return { mask, WebkitMask: mask };
};

/**
 * The Roumdoul logo with the loading animation around it:
 *  - a soft rose glow pulsing behind,
 *  - a comet arc (fading tail, glowing head) circling the outside,
 *  - a thinner arc turning the other way inside it,
 *  - the logo itself on a white disc, gently breathing.
 * Size it with `className` (default size-16). Still, without the motion, for
 * people who ask for reduced motion.
 */
export function LogoSpinner({ className }: { className?: string }) {
  return (
    <span aria-hidden className={cn("relative block size-16", className)} style={{ color: LOGO_ROSE }}>
      <span className="absolute inset-[12%] rounded-full bg-current opacity-40 blur-xl motion-safe:animate-[logo-glow_2.4s_ease-in-out_infinite]" />

      {/* Outer comet: a faint track, then the arc and its head spinning round it. */}
      <span className="absolute inset-0 rounded-full border-[3px] border-current opacity-10" />
      <span className="absolute inset-0 motion-safe:animate-spin motion-safe:[animation-duration:1.1s]">
        <span
          className="absolute inset-0 rounded-full"
          style={{ background: "conic-gradient(from 0deg, transparent 0 35%, currentColor)", ...ring("3px") }}
        />
        <span className="absolute -top-[1.5px] left-1/2 size-1.5 -translate-x-1/2 rounded-full bg-current shadow-[0_0_8px_2px_currentColor]" />
      </span>

      {/* Inner arc, thinner and the other way round. */}
      <span className="absolute inset-[11%] motion-safe:animate-spin motion-safe:[animation-direction:reverse] motion-safe:[animation-duration:1.8s]">
        <span
          className="absolute inset-0 rounded-full opacity-60"
          style={{ background: "conic-gradient(from 180deg, transparent 0 65%, currentColor)", ...ring("2px") }}
        />
      </span>

      <span className="absolute inset-[23%] flex items-center justify-center rounded-full bg-white shadow-[0_4px_12px_-2px_rgb(194_124_121/0.45)] motion-safe:animate-[logo-breathe_2.4s_ease-in-out_infinite]">
        <img src="/logoroumdoul.png" alt="" className="size-[88%] object-contain" />
      </span>
    </span>
  );
}

/**
 * The card every loading state shows in the middle of the screen (a page's
 * data loading, a save in progress): the logo loader over one line of text.
 * `glass` gives the frosted look of the phone home screen.
 * Centring is the caller's job — this is only the card.
 */
export function LoaderCard({ label, glass = false }: { label: string; glass?: boolean }) {
  return (
    <div
      className={cn(
        "flex min-w-44 flex-col items-center gap-3.5 rounded-3xl px-7 pt-6 pb-5 text-sm font-medium",
        // Blurred glass is never animated (costly on budget phones); the solid card fades in.
        glass
          ? "glass-surface text-ink"
          : "bg-popover/95 text-popover-foreground shadow-xl ring-1 ring-foreground/10 backdrop-blur motion-safe:animate-in motion-safe:fade-in-0 motion-safe:zoom-in-95 duration-200",
      )}
    >
      <LogoSpinner />
      {label}
    </div>
  );
}
