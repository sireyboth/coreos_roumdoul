import { useId } from "react";

/**
 * The help assistant's robot mascot: a friendly robot face drawn in SVG, in the
 * app's own colours (indigo primary + teal eyes from --chart-3), so it follows
 * the theme and stays sharp at any size. Decorative only — the button that
 * holds it carries the accessible name.
 */
export function AssistantRobot({ className }: { className?: string }) {
  // Unique gradient ids, so two robots on one page never clash.
  const id = useId();
  const bg = `${id}-bg`;
  const face = `${id}-face`;

  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={bg} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" style={{ stopColor: "var(--chart-1)" }} />
          <stop offset="100%" style={{ stopColor: "var(--primary)" }} />
        </linearGradient>
        <linearGradient id={face} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#e8eafc" />
        </linearGradient>
      </defs>

      {/* Round background */}
      <circle cx="32" cy="32" r="32" fill={`url(#${bg})`} />

      {/* Antenna */}
      <line x1="32" y1="16" x2="32" y2="10" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="32" cy="9" r="3" style={{ fill: "var(--chart-4)" }} />

      {/* Ears */}
      <rect x="11" y="27" width="5" height="12" rx="2.5" fill="#ffffff" opacity="0.85" />
      <rect x="48" y="27" width="5" height="12" rx="2.5" fill="#ffffff" opacity="0.85" />

      {/* Head */}
      <rect x="15" y="16" width="34" height="32" rx="11" fill={`url(#${face})`} />

      {/* Visor */}
      <rect x="20" y="23" width="24" height="15" rx="7.5" style={{ fill: "var(--primary)" }} opacity="0.92" />

      {/* Eyes, with a small shine */}
      <circle cx="27" cy="30.5" r="3.2" style={{ fill: "var(--chart-3)" }} />
      <circle cx="37" cy="30.5" r="3.2" style={{ fill: "var(--chart-3)" }} />
      <circle cx="28" cy="29.5" r="1" fill="#ffffff" />
      <circle cx="38" cy="29.5" r="1" fill="#ffffff" />

      {/* Smile and cheeks */}
      <path d="M27.5 42.5 Q32 45.5 36.5 42.5" fill="none" style={{ stroke: "var(--primary)" }} strokeWidth="2" strokeLinecap="round" />
      <circle cx="21.5" cy="42" r="1.8" style={{ fill: "var(--chart-5)" }} opacity="0.35" />
      <circle cx="42.5" cy="42" r="1.8" style={{ fill: "var(--chart-5)" }} opacity="0.35" />
    </svg>
  );
}
