import { Bell, Boxes, Cake, CalendarHeart, Clock, FileClock, Send, Sparkles, type LucideIcon } from "lucide-react";

// How each kind of alert looks: an icon on a coloured tile instead of the
// emoji older alerts carry in their titles.

type AlertStyle = { icon: LucideIcon; tone: string };

// First matching prefix wins, so keep the specific ones above the general ones.
const STYLES: [prefix: string, style: AlertStyle][] = [
  ["birthday", { icon: Cake, tone: "from-rose-500 to-amber-400" }],
  ["request.leave", { icon: CalendarHeart, tone: "from-violet-500 to-purple-500" }],
  ["request.late_early", { icon: Clock, tone: "from-amber-500 to-orange-500" }],
  ["request.", { icon: Send, tone: "from-indigo-500 to-violet-500" }],
  ["attendance.", { icon: FileClock, tone: "from-emerald-500 to-teal-500" }],
  ["welcome", { icon: Sparkles, tone: "from-indigo-500 to-fuchsia-500" }],
  ["module_access_changed", { icon: Boxes, tone: "from-slate-500 to-slate-700" }],
];

const FALLBACK: AlertStyle = { icon: Bell, tone: "from-sky-500 to-indigo-500" };

export function alertStyle(type: string): AlertStyle {
  return STYLES.find(([prefix]) => type.startsWith(prefix))?.[1] ?? FALLBACK;
}

// Leading emoji (with any joiners/variation selectors) and the space after them.
// Built with RegExp because the TS target (ES2017) rejects \p{…} in a literal.
const LEADING_EMOJI = new RegExp("^(?:\\p{Extended_Pictographic}|\\uFE0F|\\u200D)+\\s*", "u");

/** The title without the emoji older alerts start with — the icon tile replaces it. */
export function alertTitle(title: string): string {
  return title.replace(LEADING_EMOJI, "");
}
