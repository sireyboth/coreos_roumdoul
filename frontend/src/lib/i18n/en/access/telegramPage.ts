// Telegram group alerts (app/dashboard/telegram/page.tsx + components/dashboard/access/telegram-*.tsx)

export const telegramPage = {
  title: "Telegram",
  description: "Post leave requests, decisions and late warnings to your company's Telegram groups — one for the whole company, or one per branch.",

  // ── Not set up on the server ─────────────────────────────────────
  unavailableTitle: "Telegram isn't set up yet",
  unavailableBody: "Your system provider needs to add the Telegram bot first. Once it's ready, you can connect your groups here.",

  // ── The list of groups ───────────────────────────────────────────
  groupsTitle: "Connected groups",
  groupsHint: "Each group gets only the posts and branches you choose for it.",
  empty: "No group connected yet",
  emptyHint: "Start with your HR or management group. You can add a group for each branch later.",
  connectGroup: "Connect a group",
  maxReached: "You've connected the most groups allowed ({n}). Disconnect one to add another.",
  manage: "Manage",
  untitled: "Your group",
  connected: "Connected",
  since: "since {date}",
  allBranches: "All branches",
  branchCount: "{n} branches",
  postTypes: "{n} post types",
  onePostType: "1 post type",
  noPosts: "No posts",

  // ── Keeping groups safe ──────────────────────────────────────────
  adviceTitle: "Keep groups safe",
  advice1: "Use private groups with HR and managers only, unless a post is meant for everyone.",
  advice2: "Remove people from a group when they leave the company.",
  advice3: "Everyone in a group reads every post in it — choose its branches and detail with that in mind.",

  // ── Which branches a group covers ────────────────────────────────
  reachLabel: "Which branches?",
  reachAll: "All branches",
  reachAllHint: "Posts about everyone in the company — for head office or management.",
  reachSome: "Chosen branches",
  reachSomeHint: "Only posts about people in these branches.",
  pickBranch: "Choose at least one branch.",
  removedBranch: "A branch this group covered no longer exists.",

  // ── How much of the employee a post shows ────────────────────────
  detailLabel: "How much to show",
  detail: {
    full: { label: "Full card", hint: "Name, Khmer name, ID, job title, department and branch." },
    basic: { label: "Name and branch", hint: "Only the name and branch — for groups many people read." },
  },

  // ── Connect dialog ───────────────────────────────────────────────
  connectTitle: "Connect a Telegram group",
  connectDescription: "Choose what the group covers, then pick the group in Telegram.",
  getLink: "Get link",
  step1: "Press Open Telegram. Telegram asks which group to add the bot to.",
  step2: "Choose your group (for example “HR – Riverside”). You must be an admin of the group.",
  step3: "The bot says “Connected” in the group, and this window closes by itself.",
  linkReady: "Link ready — it works once and expires at {time}.",
  openTelegram: "Open Telegram",
  copyLink: "Copy link",
  copied: "Link copied",
  manualHint: "On a computer without Telegram? Copy the link and open it on your phone.",
  waiting: "Waiting for Telegram…",
  connectedToast: "Connected: {title}",

  // ── Manage dialog ────────────────────────────────────────────────
  eventsTitle: "What this group gets",
  events: {
    requests: { label: "New requests", hint: "Who asked, the leave type, dates and number of days." },
    request_decisions: { label: "Approvals and rejections", hint: "The same details, with who approved or rejected it." },
    late_warnings: { label: "Late warnings", hint: "Who, how many times this month, and which days." },
  },
  lateCaution: "This names who was late, and on which days, to everyone in the group. Best kept to HR or management groups.",
  lateOff: "Late warnings are off in Attendance, so none are posted yet.",
  lateOffAction: "Turn on",
  privacy: "Posts never include pay, phone numbers, leave reasons or managers' remarks.",
  save: "Save",
  saved: "Saved",
  sendTest: "Send test message",
  testSent: "Test message sent — check the group",
  disconnect: "Disconnect",
  disconnectTitle: "Disconnect {title}?",
  disconnectBody: "The bot leaves the group and nothing more is posted there. You can connect it again at any time.",
  disconnected: "Group disconnected",

  // ── Sample post ──────────────────────────────────────────────────
  sample: {
    title: "Sample post",
    hint: "What a group sees. Real posts use your employees' details and are sent in English.",
    bot: "Business OS bot",
    tabs: { request: "Leave request", decision: "Approved", late: "Late warning" },
  },
};
