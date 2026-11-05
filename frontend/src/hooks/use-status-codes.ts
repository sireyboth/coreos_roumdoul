"use client";

import { useEffect, useSyncExternalStore } from "react";
import { api, getToken, type ReportCodes } from "@/lib/api";
import { DEFAULT_REPORT_CODES } from "@/lib/attendance/status-codes";

// The company's status codes, fetched once per sign-in and shared by every
// screen; until they arrive (or if they can't load) screens use the defaults.
let codes: ReportCodes | null = null;
let loadedFor: string | null = null;
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function load(force = false) {
  const token = getToken();
  if (!token || (!force && (loading || loadedFor === token))) return;
  loading = api.attendance
    .reportCodes()
    .then((data) => {
      codes = data;
      loadedFor = token;
      emit();
    })
    // A screen still draws with the defaults; the next screen tries again.
    .catch(() => {})
    .finally(() => (loading = null));
}

/** Put fresh codes in place for every screen at once (after the settings page saves). */
export function setStatusCodes(data: ReportCodes) {
  codes = data;
  loadedFor = getToken();
  emit();
}

/** The codes every status is shown with — the company's own, or the defaults until they load. */
export function useStatusCodes(): ReportCodes {
  const current = useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    // Someone else signed in on this device: their company's codes, not ours.
    () => (codes && loadedFor === getToken() ? codes : DEFAULT_REPORT_CODES),
    () => DEFAULT_REPORT_CODES,
  );
  useEffect(() => load(), []);
  return current;
}
