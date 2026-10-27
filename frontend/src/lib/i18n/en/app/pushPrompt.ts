// Ask to turn on notifications (components/dashboard/push-prompt.tsx).

export const pushPrompt = {
  // ── iPhone in Safari: add to Home Screen first ────────────────────
  iphone: {
    title: "Get notifications on your iPhone",
    description: "iPhone only sends notifications to apps on your Home Screen. Add it once:",
    step1Before: "Tap the Share button",
    step1After: "at the bottom of Safari.",
    // "Choose Add to Home Screen, then Add." — the two iPhone button names stay in bold.
    step2Before: "Choose",
    step2Middle: ", then",
    step2After: ".",
    step3: "Open the app from the new icon on your Home Screen.",
    gotIt: "Got it",
  },

  // ── Turn on ───────────────────────────────────────────────────────
  ask: {
    title: "Turn on notifications?",
    description: "Get alerts for attendance, approvals and other updates on this device — even when the app is closed.",
    notNow: "Not now",
    allow: "Allow",
    wait: "Just a moment…",
  },

  // ── Result messages ───────────────────────────────────────────────
  result: {
    on: "Notifications are on for this device.",
    blocked: "Notifications are blocked. Turn them on for this site in your phone or browser settings.",
    failed: "Couldn't turn on notifications. Try again from the bell.",
  },
};
