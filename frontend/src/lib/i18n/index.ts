import { useCallback, useSyncExternalStore } from "react";
import { en, type Dictionary } from "./en";
import { km } from "./km";

// The app's language (Khmer by default), chosen per device and kept in
// localStorage. Only the phone home screen, tab bar and Home button are
// translated so far — add keys to en.ts/km.ts as more pages follow.
//
//   const t = useT();
//   t("today.badge")                          → "ថ្ងៃនេះ" / "Today"
//   t("today.worked", { time: "3h 20m" })     → fills {time}
//   navLabel(lang, "/dashboard/attendance")   → that page's name

export type Lang = "km" | "en";

const DICTIONARIES: Record<Lang, Dictionary> = { km, en };
const KEY = "lang";
const EVENT = "lang-change";

function read(): Lang {
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

export function setLang(lang: Lang) {
  try {
    localStorage.setItem(KEY, lang);
  } catch {
    // Private mode etc. — the switch still works until the page reloads.
  }
  window.dispatchEvent(new Event(EVENT));
}

export function useLang(): Lang {
  return useSyncExternalStore(subscribe, read, () => "km");
}

// Every "section.key" path in the dictionary, so a typo is a compile error.
type Paths<T, P extends string = ""> = {
  [K in keyof T & string]: T[K] extends string ? `${P}${K}` : Paths<T[K], `${P}${K}.`>;
}[keyof T & string];
export type TKey = Exclude<Paths<Dictionary>, `nav.${string}`>;

export function translate(lang: Lang, key: TKey, vars?: Record<string, string | number>): string {
  const [section, name] = key.split(".") as [keyof Dictionary, string];
  const text = (DICTIONARIES[lang][section] as Record<string, string>)[name];
  return vars ? text.replace(/\{(\w+)\}/g, (_, v: string) => String(vars[v] ?? `{${v}}`)) : text;
}

/** A page's name by URL, or `fallback` when the dictionary doesn't have it. */
export function navLabel(lang: Lang, href: string, fallback = href): string {
  return (DICTIONARIES[lang].nav as Record<string, string>)[href] ?? fallback;
}

export function useT() {
  const lang = useLang();
  return useCallback((key: TKey, vars?: Record<string, string | number>) => translate(lang, key, vars), [lang]);
}
