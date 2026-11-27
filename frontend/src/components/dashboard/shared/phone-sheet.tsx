/**
 * A dialog that behaves like a native app's bottom sheet on phones and stays a
 * centred card on wider screens. Add PHONE_SHEET to <DialogContent>'s className
 * and put <SheetHandle /> first inside it.
 */

// Phones: pinned to the bottom edge, rounded only on top, slides up instead of zooming in.
export const PHONE_SHEET =
  "max-sm:top-auto max-sm:bottom-0 max-sm:left-0 max-sm:max-h-[92dvh] max-sm:max-w-full max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-b-none max-sm:rounded-t-3xl max-sm:duration-300 max-sm:data-open:slide-in-from-bottom max-sm:data-open:zoom-in-100 max-sm:data-closed:slide-out-to-bottom max-sm:data-closed:zoom-out-100";

/** Grab handle: a phone sheet's cue that it can be dismissed. Hidden on wider screens. */
export function SheetHandle() {
  return (
    <div className="flex justify-center pt-2.5 sm:hidden" aria-hidden>
      <span className="h-1 w-10 rounded-full bg-muted-foreground/30" />
    </div>
  );
}
