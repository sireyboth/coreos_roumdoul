import type { Dictionary } from "../../en";

// Notification bell (components/dashboard/layout/notification-bell.tsx) — same keys as en/app/notifications.ts.

export const notifications: Dictionary["app"]["notifications"] = {
  // ── Bell & list ───────────────────────────────────────────────────
  title: "ការជូនដំណឹង",
  bellUnread: "ការជូនដំណឹង មិនទាន់អាន {n}",
  markAllRead: "សម្គាល់ថាបានអានទាំងអស់",
  empty: "មិនទាន់មានការជូនដំណឹងនៅឡើយទេ។",
  open: "បើក",
  resolvedBy: "{status} ដោយ {name}",

  // ── Birthday card ─────────────────────────────────────────────────
  birthday: "ខួបកំណើត",
  openYourCard: "បើកកាតជូនពររបស់លោកអ្នក",
  openCard: "បើកកាតជូនពរ",

  // ── How long ago ──────────────────────────────────────────────────
  ago: {
    justNow: "អម្បាញ់មិញ",
    minutes: "{n} នាទីមុន",
    hours: "{n} ម៉ោងមុន",
    days: "{n} ថ្ងៃមុន",
  },

  // ── Notifications on this device ──────────────────────────────────
  device: {
    wait: "សូមរង់ចាំបន្តិច…",
    turnOff: "ការជូនដំណឹងបានបើកលើឧបករណ៍នេះ — ចុចដើម្បីបិទ",
    turnOn: "បើកការជូនដំណឹងលើឧបករណ៍នេះ",
    iphone: "ដើម្បីទទួលការជូនដំណឹងលើ iPhone៖ សូមចុច Share → Add to Home Screen រួចបើកកម្មវិធីពីអេក្រង់ដើម (Home Screen)។",
    blocked: "ការជូនដំណឹងត្រូវបានរារាំងសម្រាប់គេហទំព័រនេះ នៅក្នុងការកំណត់កម្មវិធីរុករករបស់លោកអ្នក។",
    popups: "បង្ហាញផ្ទាំងលោតឡើង នៅពេលផ្ទាំងនេះមិនបានបើក",
    popupsBlocked: "ផ្ទាំងលោតឡើងត្រូវបានរារាំងសម្រាប់គេហទំព័រនេះ នៅក្នុងការកំណត់កម្មវិធីរុករករបស់លោកអ្នក។",
  },
};
