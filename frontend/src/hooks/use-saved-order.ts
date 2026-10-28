"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

// A list order the person chose themselves (dragging tiles on the home page…),
// kept per device in localStorage. Pair it with <SortableGrid>:
//
//   const { ordered, setOrder, reset, isCustom } = useSavedOrder(`home.grid.${userId}`, ids);
//
// The saved list is merged with the code's current list every time, so a new
// item added in code appears at the end, and one that was removed or that the
// person can no longer see simply drops out. Nothing to migrate, ever.

const EVENT = "saved-order-change";

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Private mode etc. — the new order still shows until the page reloads.
  }
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** Saved ids first (only those still in `ids`), then any new ids in their default order. */
function merge(saved: string | null, ids: string[]): string[] {
  let list: unknown;
  try {
    list = saved ? JSON.parse(saved) : null;
  } catch {
    list = null;
  }
  if (!Array.isArray(list)) return ids;
  const known = new Set(ids);
  const kept = list.filter((id): id is string => typeof id === "string" && known.has(id));
  const keptSet = new Set(kept);
  return [...kept, ...ids.filter((id) => !keptSet.has(id))];
}

const sameOrder = (a: string[], b: string[]) => a.length === b.length && a.every((id, i) => id === b[i]);

export type SavedOrder = {
  /** `ids` in the person's order. */
  ordered: string[];
  /** Save a new order (saving the default order just clears it). */
  setOrder: (next: string[]) => void;
  /** Back to the order the code gives. */
  reset: () => void;
  /** True when the order differs from the default — e.g. to show a "Reset" button. */
  isCustom: boolean;
};

/**
 * @param storageKey where to keep it — include the user id so people sharing a
 *   phone each keep their own. `null` (e.g. still loading who's signed in) uses the default order.
 * @param ids the default order; keep it stable across renders or memoise it.
 */
export function useSavedOrder(storageKey: string | null, ids: string[]): SavedOrder {
  const saved = useSyncExternalStore(
    subscribe,
    () => (storageKey ? read(storageKey) : null),
    () => null, // The server has no localStorage: render the default, then swap in.
  );
  const ordered = useMemo(() => merge(saved, ids), [saved, ids]);

  const setOrder = useCallback(
    (next: string[]) => {
      if (storageKey) write(storageKey, sameOrder(next, ids) ? null : JSON.stringify(next));
    },
    [storageKey, ids],
  );
  const reset = useCallback(() => {
    if (storageKey) write(storageKey, null);
  }, [storageKey]);

  return { ordered, setOrder, reset, isCustom: !sameOrder(ordered, ids) };
}
