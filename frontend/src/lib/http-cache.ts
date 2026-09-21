/**
 * A tiny cache for GET requests to reference data (branches, departments,
 * employees…). Two jobs:
 *  - identical requests already in flight share one network call, so a page
 *    and its dialogs asking for the same list at once cost a single request;
 *  - a recent answer is reused for `ttlMs`, so moving between pages doesn't
 *    re-download the same lists every time.
 * Anything that changes data clears it, so a save is never followed by stale
 * lists. Values are cloned on the way out so a caller can't corrupt the cache
 * by sorting or editing what it received.
 */
export function createHttpCache(ttlMs: number, now: () => number = Date.now) {
  const done = new Map<string, { at: number; value: unknown }>();
  const inflight = new Map<string, Promise<unknown>>();
  // Bumped by clear(): an answer that was already on its way when data changed must not be stored.
  let generation = 0;

  const clone = <T>(value: T): T => structuredClone(value);

  return {
    async get<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
      const hit = done.get(key);
      if (hit && now() - hit.at < ttlMs) return clone(hit.value as T);

      let pending = inflight.get(key) as Promise<T> | undefined;

      if (!pending) {
        const startedIn = generation;
        pending = fetcher()
          .then((value) => {
            if (startedIn === generation) done.set(key, { at: now(), value: clone(value) });
            return value;
          })
          .finally(() => {
            // Only remove our own entry (a clear() may have replaced it).
            if (inflight.get(key) === pending) inflight.delete(key);
          });
        inflight.set(key, pending);
      }

      return clone(await pending);
    },

    clear() {
      generation++;
      done.clear();
      inflight.clear();
    },

    /** For tests. */
    size: () => done.size,
  };
}
