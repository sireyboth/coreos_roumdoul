/**
 * Counts the work the user is waiting on (saves, deletes, exports). While the
 * count is above zero the app shows a full-screen overlay that swallows clicks
 * and key presses, so nobody can double-submit or navigate away mid-save.
 *
 * request() in api.ts tracks every write automatically. For other slow work
 * (a file download, building a PDF) wrap it yourself:
 *
 *   await withBusy(() => api.payroll.exportRun(id, name));
 */

let count = 0;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

export function subscribeBusy(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function isBusy() {
  return count > 0;
}

export async function withBusy<T>(work: () => Promise<T>): Promise<T> {
  count++;
  emit();
  try {
    return await work();
  } finally {
    count--;
    emit();
  }
}

/*
 * Page loading: the reads a page makes as it opens. Until they finish, the
 * page's content can't be clicked (see PageLoadGate), so nobody acts on a
 * half-loaded screen — e.g. editing a row before its options arrived.
 *
 * Which reads count, without any page having to opt in:
 *  - those that start just after a page opens (beginPageLoad), and
 *  - those that start while counted ones are still running — including a read
 *    started from another one's .then(), thanks to SETTLE_MS.
 * Anything later (typing in a search, a poll, a refresh) never blocks.
 */

// How long after a page opens a read still counts as part of opening it.
const OPEN_WINDOW_MS = 400;
// A finished read keeps the page blocked this much longer, so a follow-up read it triggers joins in.
const SETTLE_MS = 80;

let loading = 0;
let openUntil = 0;

export function isPageLoading() {
  return loading > 0;
}

/** Called by the dashboard layout whenever a page opens. */
export function beginPageLoad() {
  openUntil = Date.now() + OPEN_WINDOW_MS;
}

export async function trackPageRead<T>(work: () => Promise<T>): Promise<T> {
  if (loading === 0 && Date.now() > openUntil) return work();

  loading++;
  emit();
  try {
    return await work();
  } finally {
    setTimeout(() => {
      loading--;
      emit();
    }, SETTLE_MS);
  }
}
