// Roumdoul brand touches shared by the home page, the profile page and any
// page that wants the same look: the solid surface card, the kbach flower in
// its corner and the damask pattern behind it.
//
//   <section className={surfaceCard}>
//     <KbachCorner />              ← flower + fading pattern, bottom-right
//     …content…
//   </section>
//
//   <Link className="relative isolate overflow-hidden …"><KbachPattern />…</Link>

/**
 * Solid content card: warm surface, hairline border, soft shadow. 26px corners
 * around 14px padding, so anything rounded inside it uses 26 − 14 = 12px.
 * `relative isolate overflow-hidden` lets KbachCorner sit behind the content.
 */
export const surfaceCard =
  "relative isolate overflow-hidden rounded-[26px] border border-surface-border bg-surface p-3.5 shadow-[0_1px_2px_rgb(43_27_18/0.05),0_12px_32px_-16px_rgb(43_27_18/0.18)] dark:shadow-[inset_0_1px_0_rgb(255_255_255/0.06)]";

// The Roumdoul kbach flower, used as a mask so it takes the brand colour in
// either theme (the PNG's own grey lines would vanish on the light surface).
const KBACH_MASK = {
  maskImage: "url(/Images/roumdolkbach.png)",
  WebkitMaskImage: "url(/Images/roumdolkbach.png)",
  maskSize: "contain",
  WebkitMaskSize: "contain",
  maskRepeat: "no-repeat",
  WebkitMaskRepeat: "no-repeat",
} as const;

/**
 * Faint kbach flower in a hero card's bottom-right corner, showing only the
 * flower's top-left quarter: the box (shaped like the image, 889×829) is pinned
 * to the corner and pushed half its own width right and half its height down,
 * past the card's clipped edges. Drawn behind the card's content (-z-10 inside
 * the card's `isolate`), so it never sits over text.
 * Light mode needs the higher opacity: the PNG's ~2px lines shrink to under
 * 1px at this size, and thin caramel lines fade into the near-white card.
 */
export function KbachCorner() {
  return (
    <>
      <KbachPattern fade />
      <span
        aria-hidden
        className="pointer-events-none absolute right-0 bottom-0 -z-10 aspect-[889/829] w-80 translate-x-[45%] translate-y-[45%] bg-brand opacity-[0.35] dark:opacity-[0.2]"
        style={KBACH_MASK}
      />
    </>
  );
}

// Damask pattern behind the hero cards' kbach flower and every Services tile.
// kbach-pattern.webp is a small (50 KB) transparent tile made from
// "pattern behind object.png" (2.6 MB — too heavy to ship): the grey ink
// became the alpha, so as a mask it takes the brand colour.
const PATTERN = "url(/Images/kbach-pattern.webp)";
const PATTERN_MASK = {
  maskImage: PATTERN,
  WebkitMaskImage: PATTERN,
  maskSize: "240px auto",
  WebkitMaskSize: "240px auto",
} as const;

// Hero cards: a second mask, a radial gradient from the bottom-right, keeps the
// pattern near the flower and fades it out before the text in the top-left.
const FADE = "radial-gradient(circle at 100% 100%, #000 0%, #000 25%, transparent 75%)";
const PATTERN_FADE_MASK = {
  maskImage: `${PATTERN}, ${FADE}`,
  WebkitMaskImage: `${PATTERN}, ${FADE}`,
  maskSize: "240px auto, 100% 100%",
  WebkitMaskSize: "240px auto, 100% 100%",
  maskRepeat: "repeat, no-repeat",
  WebkitMaskRepeat: "repeat, no-repeat",
  // Show the pattern only where the gradient is solid too.
  maskComposite: "intersect",
  WebkitMaskComposite: "source-in",
} as const;

/**
 * The pattern filling its parent, behind the parent's content. The parent
 * needs `relative isolate overflow-hidden` (and rounds the corners).
 */
export function KbachPattern({ fade = false }: { fade?: boolean }) {
  return (
    <span
      aria-hidden
      // Light mode needs more: 5% caramel on the near-white surface is all but invisible.
      className="pointer-events-none absolute inset-0 -z-10 bg-brand opacity-[0.12] dark:opacity-5"
      style={fade ? PATTERN_FADE_MASK : PATTERN_MASK}
    />
  );
}
