import { useCallback, useSyncExternalStore } from "react";
import { en, type Dictionary } from "./en";
import { km } from "./km";

// The app's language (Khmer by default), chosen per device and kept in
// localStorage. Strings live in en/<module>.ts and km/<module>.ts; keys read
// "module.section.key". Approved wording is in GLOSSARY.md.
//
//   const t = useT();
//   t("home.today.badge")                     → "ថ្ងៃនេះ" / "Today"
//   t("home.today.worked", { time: "3h 20m" })→ fills {time}
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

/** The chosen language outside React (api.ts sends it as Accept-Language, so server messages match). */
export function currentLang(): Lang {
  return read();
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
export type TKey = Exclude<Paths<Dictionary>, `nav.${string}` | `sidebar.items.${string}`>;

export function translate(lang: Lang, key: TKey, vars?: Record<string, string | number>): string {
  const text = key.split(".").reduce<unknown>((node, part) => (node as Record<string, unknown>)[part], DICTIONARIES[lang]) as string;
  return vars ? text.replace(/\{(\w+)\}/g, (_, v: string) => String(vars[v] ?? `{${v}}`)) : text;
}

/** A page's short name by URL (phone tiles, tab bar), else its full name, else `fallback`. */
export function navLabel(lang: Lang, href: string, fallback = href): string {
  return (DICTIONARIES[lang].nav as Record<string, string>)[href] ?? pageLabel(lang, href, fallback);
}

/** A page's full name by URL (sidebar), or `fallback` when the dictionary doesn't have it. */
export function pageLabel(lang: Lang, href: string, fallback = href): string {
  return (DICTIONARIES[lang].sidebar.items as Record<string, string>)[href] ?? fallback;
}

export function useT() {
  const lang = useLang();
  return useCallback((key: TKey, vars?: Record<string, string | number>) => translate(lang, key, vars), [lang]);
}

/** Outside React (toasts, helpers): the string in the language chosen right now. */
export function translateNow(key: TKey, vars?: Record<string, string | number>): string {
  return translate(read(), key, vars);
}

/** The locale for toLocaleDateString / toLocaleString. Khmer keeps Western digits (GLOSSARY.md). */
export function dateLocale(lang: Lang): string | undefined {
  return lang === "km" ? "km" : undefined;
}
