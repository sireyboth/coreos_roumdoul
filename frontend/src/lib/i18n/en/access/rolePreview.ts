// Role preview (components/dashboard/access/role-preview.tsx) — inside the role editor and from the Roles table.

export const rolePreview = {
  button: "Preview",
  backToEdit: "Back to editing",
  title: "Preview: “{name}”",
  description: "What someone with this role will see in the menu and be able to do.",

  // ── Menu ─────────────────────────────────────────────────────────
  menuTitle: "Menu they will see",
  menuEmpty: "No pages — they can only open their own profile.",
  menuHint: "Click a page to see what they can do there. Pages from modules your company hasn't turned on are not shown.",

  // ── One page (a menu item clicked) ───────────────────────────────
  page: {
    title: "On this page",
    back: "All areas",
    hint: "What this role can see and do here.",
    level: {
      manage: "Can see everything here and add, edit or delete.",
      view: "Can open and read this part, but not change it.",
      none: "This part is hidden from them on this page.",
    },
  },

  // ── Abilities ────────────────────────────────────────────────────
  abilitiesTitle: "What they can do",
  nothing: "Nothing",
  bucket: {
    manage: { title: "Can change", hint: "See, add, edit and delete." },
    view: { title: "View only", hint: "Can open and read, but not change." },
    extra: { title: "Extra rights", hint: "Special actions turned on for this role." },
    none: { title: "No access", hint: "Hidden from them completely." },
  },
};
