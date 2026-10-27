// Help assistant chat (components/dashboard/ai-assistant.tsx). Answers come from the server.

export const assistant = {
  // ── Button & header ───────────────────────────────────────────────
  open: "Open help assistant",
  button: "Help",
  title: "Help assistant",
  subtitle: "Ask how to use CoreOS. English or Khmer.",

  // ── Suggested questions ───────────────────────────────────────────
  tryThese: "Try one of these:",
  suggestion1: "How do I lock a month?",
  suggestion2: "How do I request leave?",
  // Kept in Khmer on purpose: shows English speakers that Khmer questions work too.
  suggestion3: "តើខ្ញុំស្កេនវត្តមានដោយរបៀបណា?",

  // ── Chat ──────────────────────────────────────────────────────────
  thinking: "Thinking",
  unavailable: "The assistant is not available right now. Try again in a few minutes.",
  limitReached: "This chat has reached {n} questions. Start a new chat to ask more.",
  newChat: "Start a new chat",
  placeholder: "Ask a question",
  yourQuestion: "Your question",
  count: "{n} of {max} questions",
};
