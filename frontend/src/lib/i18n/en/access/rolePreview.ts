// Role preview (components/dashboard/access/role-preview.tsx) — inside the role editor and from the Roles table.

export const rolePreview = {
  button: "Preview",
  backToEdit: "Back to editing",
  title: "Preview: “{name}”",
  description: "What someone with this role will see in the menu and be able to do.",

  // ── Menu ─────────────────────────────────────────────────────────
  menuTitle: "Menu they will see",
  menuEmpty: "No pages — they can only open their own profile.",
  menuHint: "Pages from modules your company hasn't turned on are not shown.",

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
