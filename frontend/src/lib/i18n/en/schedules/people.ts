// Who follows a schedule (components/dashboard/schedule-people-dialog.tsx).

export const people = {
  // ── Header ────────────────────────────────────────────────────────
  title: "People on {name}",
  followsOne: "{n} person follows it today.",
  followsMany: "{n} people follow it today.",
  followsOneMore: "{n} person follows it today, {more} more from a later date.",
  followsManyMore: "{n} people follow it today, {more} more from a later date.",

  // ── Tabs & search ─────────────────────────────────────────────────
  today: "Today ({n})",
  upcoming: "Upcoming ({n})",
  search: "Search by name or ID…",

  // ── List ──────────────────────────────────────────────────────────
  noMatch: "Nobody matches that search.",
  noneToday: "Nobody follows this schedule today.",
  noneLater: "Nobody starts it later.",
  since: "Since {from}",
  sinceUntil: "Since {from} until {to}",
  from: "From {from}",
  fromUntil: "From {from} until {to}",
  off: "Off {days}",
};
