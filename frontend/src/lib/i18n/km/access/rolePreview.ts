import type { Dictionary } from "../../en";

// Role preview (components/dashboard/access/role-preview.tsx) — same keys as en/access/rolePreview.ts.

export const rolePreview: Dictionary["access"]["rolePreview"] = {
  button: "មើលជាមុន",
  backToEdit: "ត្រឡប់ទៅកែប្រែ",
  title: "មើលជាមុន៖ “{name}”",
  description: "អ្វីដែលអ្នកមានតួនាទីនេះនឹងឃើញក្នុងម៉ឺនុយ និងអាចធ្វើបាន។",

  // ── Menu ─────────────────────────────────────────────────────────
  menuTitle: "ម៉ឺនុយដែលពួកគេនឹងឃើញ",
  menuEmpty: "គ្មានទំព័រ — អាចបើកបានតែប្រវត្តិរូបផ្ទាល់ខ្លួនប៉ុណ្ណោះ។",
  menuHint: "ទំព័រនៃមុខងារដែលក្រុមហ៊ុនមិនទាន់បើក នឹងមិនបង្ហាញទេ។",

  // ── Abilities ────────────────────────────────────────────────────
  abilitiesTitle: "អ្វីដែលពួកគេអាចធ្វើបាន",
  nothing: "គ្មាន",
  bucket: {
    manage: { title: "អាចកែប្រែ", hint: "មើល បន្ថែម កែប្រែ និងលុប។" },
    view: { title: "មើលតែប៉ុណ្ណោះ", hint: "អាចបើកមើលបាន ប៉ុន្តែមិនអាចកែប្រែ។" },
    extra: { title: "សិទ្ធិបន្ថែម", hint: "សកម្មភាពពិសេសដែលបានបើកសម្រាប់តួនាទីនេះ។" },
    none: { title: "គ្មានសិទ្ធិ", hint: "លាក់ទាំងស្រុងពីពួកគេ។" },
  },
};
