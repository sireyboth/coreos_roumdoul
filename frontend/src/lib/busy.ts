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
