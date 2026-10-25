import { useSyncExternalStore } from "react";

// The phone home screen's language (Khmer by default), shared by the home
// page, the bottom tab bar and the header's Home button. Kept per device in
// localStorage — the rest of the app is still English-only.

export type HomeLang = "km" | "en";

const KEY = "home-lang";
const EVENT = "home-lang-change";

function read(): HomeLang {
  try {
    return localStorage.getItem(KEY) === "en" ? "en" : "km";
  } catch {
    return "km";
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function setHomeLang(lang: HomeLang) {
  try {
    localStorage.setItem(KEY, lang);
  } catch {
    // Private mode etc. — the switch still works until the page reloads.
  }
  window.dispatchEvent(new Event(EVENT));
}

export function useHomeLang(): HomeLang {
  return useSyncExternalStore(subscribe, read, () => "km");
}

/** Picks the string for the current language: t({ km: "…", en: "…" }). */
export function useT() {
  const lang = useHomeLang();
  return (text: { km: string; en: string }) => text[lang];
}

// Khmer names for the nav pages the home screen and tab bar link to.
export const NAV_KM: Record<string, string> = {
  "/dashboard": "ទិដ្ឋភាពទូទៅ",
  "/dashboard/attendance": "វត្តមាន",
  "/dashboard/requests": "ច្បាប់ឈប់",
  "/dashboard/payroll": "ប្រាក់ខែ",
  "/dashboard/calendar": "ប្រតិទិន",
  "/dashboard/work-schedules": "កាលវិភាគ",
  "/dashboard/employees": "បុគ្គលិក",
  "/dashboard/id-cards": "កាតបុគ្គលិក",
  "/dashboard/profile": "គណនី",
  "/dashboard/holidays": "ថ្ងៃឈប់សម្រាក",
  "/dashboard/branches": "សាខា",
  "/dashboard/teams": "ក្រុម",
  "/dashboard/attendance/corrections": "កែតម្រូវវត្តមាន",
  "/dashboard/audit": "កំណត់ហេតុសកម្មភាព",
};
