"use client";

import { useCallback, useEffect, useState, type DependencyList } from "react";
import { ApiError } from "@/lib/api";
import { notifyError } from "@/lib/notify";

type Result<T> = { deps: DependencyList; data: T | null; error: string | null };

export type ApiState<T> = {
  /** The answer for the current deps — null while it loads (or if it failed). */
  data: T | null;
  /** A message to show when the request failed, else null. */
  error: string | null;
  loading: boolean;
  /** Fetch again with the same deps (after a save, a "Retry" button…). */
  reload: () => void;
};

export type ApiOptions = {
  /** Shown when the failure isn't an API error with its own message. */
  errorMessage?: string;
  /** Also pop the error as a toast (notifyError). */
  notify?: boolean;
  /** While a new answer loads, keep returning the previous one instead of null. */
  keepPrevious?: boolean;
};

const DEFAULT_ERROR = "Couldn't load this. Please try again.";

const sameDeps = (a: DependencyList, b: DependencyList) => a.length === b.length && a.every((v, i) => Object.is(v, b[i]));

/**
 * Loads something when the component mounts and again whenever `deps` change —
 * the "let cancelled = false … then … catch … cleanup" effect, written once.
 *
 *   const { data: today, error } = useApi(() => api.attendance.today(), []);
 *   const { data, reload } = useApi(() => api.audit.list({ page }), [page], { notify: true });
 *   const { data } = useApi(group ? () => api.payroll.groupPeriods(group.id) : null, [group?.id]);
 *
 * Pass null instead of a function to skip loading (data stays null, not loading).
 * The result is kept with the deps it answers, so after a change the old data
 * is never shown as if it were the new one — `data` goes back to null and
 * `loading` to true until the new answer arrives (unless keepPrevious). An
 * answer that comes back after the deps changed, or after unmount, is dropped.
 */
export function useApi<T>(load: (() => Promise<T>) | null, deps: DependencyList, options: ApiOptions = {}): ApiState<T> {
  const { errorMessage, notify = false, keepPrevious = false } = options;
  const [reloads, setReloads] = useState(0);
  const [result, setResult] = useState<Result<T> | null>(null);
  const key = [...deps, reloads];
  const enabled = load !== null;

  useEffect(() => {
    if (!load) return;
    let cancelled = false;
    load()
      .then((data) => !cancelled && setResult({ deps: key, data, error: null }))
      .catch((err) => {
        if (cancelled) return;
        // Without errorMessage the toast keeps notifyError's own wording.
        if (notify) notifyError(err, errorMessage);
        setResult({ deps: key, data: null, error: err instanceof ApiError && err.message ? err.message : (errorMessage ?? DEFAULT_ERROR) });
      });
    return () => {
      cancelled = true;
    };
    // `load` is a new function every render; the caller's deps say when it really changed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, ...key]);

  const current = result && sameDeps(result.deps, key) ? result : null;
  const shown = current ?? (keepPrevious ? result : null);
  const reload = useCallback(() => setReloads((n) => n + 1), []);

  return {
    data: shown?.data ?? null,
    error: current?.error ?? null,
    loading: enabled && !current,
    reload,
  };
}
