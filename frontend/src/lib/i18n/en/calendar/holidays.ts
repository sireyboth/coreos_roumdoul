// Holidays page and its add/edit dialog (app/dashboard/holidays/page.tsx)

export const holidays = {
  // ── Header ────────────────────────────────────────────────────────
  title: "Holidays",
  description: "Company-wide non-working days.",
  importCambodian: "Import Cambodian holidays",
  add: "Add holiday",

  // ── Table ─────────────────────────────────────────────────────────
  colRecurs: "Recurs",
  yearly: "Yearly",
  search: "Search holidays…",
  emptyTitle: "No holidays yet",
  emptyText: "Add your company's public holidays so they're excluded from the roster.",

  // ── Delete ────────────────────────────────────────────────────────
  deleteTitle: "Delete \"{name}\"?",
  deleteText: "It will no longer be treated as a holiday.",
  deleted: "\"{name}\" deleted",

  // ── Add / edit dialog ─────────────────────────────────────────────
  editTitle: "Edit \"{name}\"",
  addTitle: "Add a holiday",
  formText: "Employees won't be scheduled on this date.",
  repeats: "Repeats every year",
  updated: "Holiday updated",
  added: "Holiday added",
};
