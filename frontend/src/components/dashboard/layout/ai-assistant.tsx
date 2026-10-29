"use client";

import { useEffect, useRef, useState } from "react";
import { MessageCircleQuestion, RotateCcw, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useMe } from "@/contexts/me-context";
import { api } from "@/lib/api";
import { translateNow, useT, type TKey } from "@/lib/i18n";

type Message = { role: "user" | "assistant"; content: string };

const SUGGESTIONS: TKey[] = ["app.assistant.suggestion1", "app.assistant.suggestion2", "app.assistant.suggestion3"];

// Questions per chat before a fresh one is needed. Each question resends the
// recent chat, so long chats cost more. Matches the server's
// AiAssistantController::QUESTIONS_PER_CHAT.
const QUESTIONS_PER_CHAT = 10;

// Fired by the header's Help button on phones (AssistantLauncher); the panel
// below listens for it, so the two need no shared state.
const OPEN_EVENT = "ai-assistant:open";

/** Same rule as the server: a paying (active) company whose plan includes the module. Trials never see it. */
function useAssistantAvailable(): boolean {
  const { me } = useMe();
  return me?.company?.status === "active" && Boolean(me.modules.ai_assistant);
}

/** Help as a plain icon button for the phone header — on phones it never floats over content. */
export function AssistantLauncher() {
  const t = useT();
  if (!useAssistantAvailable()) return null;
  return (
    <Button variant="ghost" size="icon" onClick={() => window.dispatchEvent(new Event(OPEN_EVENT))} aria-label={t("app.assistant.open")}>
      <MessageCircleQuestion />
    </Button>
  );
}

export function AiAssistant() {
  const t = useT();
  const [open, setOpen] = useState(false);
  // True while the panel plays its exit animation; it unmounts when that ends.
  const [closing, setClosing] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const asked = messages.filter((m) => m.role === "assistant").length;
  const limitReached = asked >= QUESTIONS_PER_CHAT;

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_EVENT, onOpen);
  }, []);

  const available = useAssistantAvailable();

  async function send(text: string) {
    const question = text.trim();
    if (!question || loading || limitReached) return;

    const history = messages;
    setMessages([...history, { role: "user", content: question }]);
    setInput("");
    setError(null);
    setLoading(true);

    try {
      const res = await api.askAssistant({ question, history });
      setMessages((m) => [...m, { role: "assistant", content: res.answer }]);
    } catch (e) {
      // Take the unanswered question back out (and back into the box) so it
      // can be retried, and so it doesn't count toward the chat's limit.
      setMessages(history);
      setInput(question);
      setError(
        e instanceof Error && e.message
          ? e.message
          : translateNow("app.assistant.unavailable"),
      );
    } finally {
      setLoading(false);
    }
  }

  function newChat() {
    setMessages([]);
    setInput("");
    setError(null);
  }

  function close() {
    // With reduced motion the exit animation is off, so animationend would
    // never fire — close straight away.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setOpen(false);
      return;
    }
    setClosing(true);
  }

  if (!available) return null;

  if (!open) {
    // Desktop only: on phones the header's Help button (AssistantLauncher) opens the panel.
    return (
      <Button
        onClick={() => setOpen(true)}
        className="fixed right-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-40 hidden h-12 rounded-full shadow-lg transition-transform duration-150 animate-in fade-in-0 zoom-in-90 hover:scale-105 active:scale-95 motion-reduce:animate-none motion-reduce:transition-none md:inline-flex"
        aria-label={t("app.assistant.open")}
      >
        <MessageCircleQuestion className="mr-2 h-5 w-5" />
        {t("app.assistant.button")}
      </Button>
    );
  }

  return (
    <section
      aria-label={t("app.assistant.title")}
      onAnimationEnd={(e) => {
        // Ignore animations bubbling up from messages inside the panel.
        if (e.target === e.currentTarget && closing) {
          setClosing(false);
          setOpen(false);
        }
      }}
      className={`fixed inset-x-2 bottom-[calc(0.5rem+env(safe-area-inset-bottom))] z-40 flex h-[min(560px,80vh)] origin-bottom-right flex-col overflow-hidden rounded-xl border bg-background shadow-xl duration-200 ease-out motion-reduce:animate-none sm:inset-x-auto sm:right-4 sm:w-95 ${
        closing
          ? "animate-out fill-mode-forwards fade-out-0 zoom-out-95 slide-out-to-bottom-4"
          : "animate-in fade-in-0 zoom-in-95 slide-in-from-bottom-4"
      }`}
    >
      <header className="flex items-center justify-between border-b px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold">{t("app.assistant.title")}</h2>
          <p className="text-xs text-muted-foreground">{t("app.assistant.subtitle")}</p>
        </div>
        <Button variant="ghost" size="icon" onClick={close} aria-label={t("common.action.close")}>
          <X className="h-4 w-4" />
        </Button>
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3 text-sm">
        {messages.length === 0 && (
          <div className="space-y-2">
            <p className="text-muted-foreground">{t("app.assistant.tryThese")}</p>
            {SUGGESTIONS.map((key) => t(key)).map((s, i) => (
              <button
                key={s}
                onClick={() => send(s)}
                // Stagger so the suggestions arrive one after another.
                style={{ animationDelay: `${120 + i * 60}ms` }}
                className="block w-full rounded-md border px-3 py-2 text-left transition-colors duration-300 animate-in fill-mode-both fade-in-0 slide-in-from-bottom-2 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:animate-none"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {messages.map((m, i) => (
          <div
            key={i}
            // Keyed by index, so only the newly added bubble mounts and animates.
            className={`whitespace-pre-wrap rounded-lg px-3 py-2 duration-300 ease-out animate-in fade-in-0 motion-reduce:animate-none ${
              m.role === "user"
                ? "ml-8 origin-bottom-right bg-primary text-primary-foreground slide-in-from-right-4 zoom-in-95"
                : "mr-8 bg-muted slide-in-from-bottom-2"
            }`}
          >
            {m.content}
          </div>
        ))}

        {loading && (
          <div
            role="status"
            aria-label={t("app.assistant.thinking")}
            className="mr-8 flex w-fit items-center gap-1 rounded-lg bg-muted px-3 py-3 duration-200 animate-in fade-in-0 motion-reduce:animate-none"
          >
            {[0, 150, 300].map((delay) => (
              <span
                key={delay}
                style={{ animationDelay: `${delay}ms` }}
                className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/60 motion-reduce:animate-none"
              />
            ))}
          </div>
        )}
        {error && (
          <p className="text-destructive duration-200 animate-in fade-in-0 slide-in-from-bottom-1 motion-reduce:animate-none">
            {error}
          </p>
        )}
        <div ref={endRef} />
      </div>

      {limitReached ? (
        <div className="space-y-2 border-t p-3 text-center duration-300 animate-in fade-in-0 slide-in-from-bottom-2 motion-reduce:animate-none">
          <p className="text-xs text-muted-foreground">
            {t("app.assistant.limitReached", { n: QUESTIONS_PER_CHAT })}
          </p>
          <Button onClick={newChat} className="w-full">
            <RotateCcw className="mr-2 h-4 w-4" />
            {t("app.assistant.newChat")}
          </Button>
        </div>
      ) : (
        <form
          className="space-y-1 border-t p-3"
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
        >
          <div className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t("app.assistant.placeholder")}
              maxLength={1000}
              disabled={loading}
              aria-label={t("app.assistant.yourQuestion")}
            />
            <Button
              type="submit"
              size="icon"
              disabled={loading || !input.trim()}
              aria-label={t("common.action.send")}
              className="transition-transform duration-150 active:scale-90 motion-reduce:transition-none"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
          {asked > 0 && (
            <p className="text-right text-xs text-muted-foreground">
              {t("app.assistant.count", { n: asked, max: QUESTIONS_PER_CHAT })}
            </p>
          )}
        </form>
      )}
    </section>
  );
}
