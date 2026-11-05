"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Cake, CalendarDays, Gift, Heart, MailOpen, PartyPopper, Sparkles, Star, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { api, type Notification } from "@/lib/api";
import { dateLocale, useLang, useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/** The birthday song (public/sounds). Starts when the envelope is opened. */
const SONG_URL = "/sounds/happy-birthday-sound.mp3";

/** How long the envelope takes to open before the card shows (ms). */
const OPENING_MS = 900;

const CONFETTI_COLORS = ["#f43f5e", "#f59e0b", "#10b981", "#3b82f6", "#a855f7", "#ec4899"];

// A fixed scatter (a cheap hash of the index) so renders stay pure and identical.
const spread = (i: number, salt: number) => ((Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453) % 1 + 1) % 1;

const CONFETTI = Array.from({ length: 40 }, (_, i) => ({
  left: spread(i, 1) * 100,
  delay: spread(i, 2) * 1.5,
  duration: 2.5 + spread(i, 3) * 2,
  size: 6 + spread(i, 4) * 6,
  color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
  round: i % 3 === 0,
}));

/** Falling confetti behind the dialog's content. */
function Confetti() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden rounded-xl">
      {CONFETTI.map((piece, i) => (
        <span
          key={i}
          className="absolute -top-4 animate-[confetti-fall_linear_infinite] motion-reduce:hidden"
          style={{
            left: `${piece.left}%`,
            width: piece.size,
            height: piece.round ? piece.size : piece.size * 0.4,
            backgroundColor: piece.color,
            borderRadius: piece.round ? "9999px" : "1px",
            animationDelay: `${piece.delay}s`,
            animationDuration: `${piece.duration}s`,
          }}
        />
      ))}
    </div>
  );
}

/**
 * A sealed envelope drawn in layers, back to front: the back, the letter inside,
 * the front pocket, then the flap with its heart seal. `opening` lifts the flap
 * and slides the letter up.
 */
function Envelope({ opening }: { opening: boolean }) {
  return (
    <div
      aria-hidden
      className={cn(
        "relative mx-auto h-40 w-60 [perspective:800px]",
        !opening && "motion-safe:animate-[envelope-wiggle_2.6s_ease-in-out_infinite]",
      )}
    >
      {/* Back of the envelope. */}
      <div className="absolute inset-0 rounded-xl bg-rose-700 shadow-2xl shadow-rose-500/30" />

      {/* The letter inside: a few "written" lines and a small cake. */}
      <div
        className={cn(
          "absolute inset-x-4 top-3 bottom-3 flex flex-col items-center gap-1.5 rounded-md bg-white px-4 pt-3 shadow-md transition-transform duration-700 ease-out",
          opening && "-translate-y-20",
        )}
      >
        <Cake className="size-6 text-rose-500" />
        <span className="h-1.5 w-3/4 rounded-full bg-rose-100" />
        <span className="h-1.5 w-2/3 rounded-full bg-amber-100" />
        <span className="h-1.5 w-1/2 rounded-full bg-rose-100" />
      </div>

      {/* Front pocket: covers the lower part of the letter, with a V cut at the top. */}
      <div className="absolute inset-0 rounded-xl bg-linear-to-br from-rose-500 via-pink-500 to-amber-400 [clip-path:polygon(0_0,50%_52%,100%_0,100%_100%,0_100%)]">
        <svg className="absolute inset-0 size-full">
          <defs>
            <pattern id="envelope-dots" width="22" height="22" patternUnits="userSpaceOnUse">
              <circle cx="4" cy="4" r="1.6" fill="white" fillOpacity="0.22" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#envelope-dots)" />
        </svg>
      </div>

      {/* The flap: folds back (and out of sight) when opening. */}
      <div
        className={cn(
          "absolute inset-x-0 top-0 h-[58%] origin-top bg-linear-to-b from-pink-400 to-rose-500 transition-transform duration-500 ease-in-out [backface-visibility:hidden] [clip-path:polygon(0_0,100%_0,50%_100%)]",
          opening && "[transform:rotateX(180deg)]",
        )}
      />

      {/* Heart seal on the flap's tip. */}
      <div
        className={cn(
          "absolute top-[58%] left-1/2 flex size-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-amber-400 text-white shadow-lg ring-4 ring-white/50 transition-all duration-300",
          opening && "scale-0 opacity-0",
        )}
      >
        <Heart className="size-5 fill-current" />
      </div>
    </div>
  );
}

type Stage = "sealed" | "opening" | "open";

/**
 * The birthday celebration: opened by a birthday alert (bell or push), whose
 * link is /dashboard?birthday={employee_id}. Its content comes from the
 * signed-in person's own alert, so nobody sees a birthday they weren't told about.
 *
 * It starts as a sealed envelope. Tapping "Open the card" starts the song — the
 * tap is what lets phones play sound — opens the envelope, then shows the card.
 */
function BirthdayCelebrationContent() {
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const t = useT();
  const lang = useLang();
  const employeeId = params.get("birthday");
  const [alert, setAlert] = useState<Notification | null>(null);
  const [stage, setStage] = useState<Stage>("sealed");
  const [playing, setPlaying] = useState(false);
  const songRef = useRef<HTMLAudioElement | null>(null);
  const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!employeeId) return;
    let cancelled = false;
    api.notifications
      .list()
      .then((list) => {
        const match = list.find((n) => n.type === "birthday" && String(n.data.employee_id) === employeeId);
        if (cancelled) return;
        if (match) {
          setAlert(match);
          if (!match.read_at) api.notifications.markAsRead(match.id).catch(() => {});
        } else {
          close();
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeId]);

  // Leaving the page never leaves the song playing.
  useEffect(() => () => stopSong(), []);

  /** Stops the song and forgets it, so the next card starts fresh. */
  function stopSong() {
    if (openTimer.current) clearTimeout(openTimer.current);
    songRef.current?.pause();
    songRef.current = null;
    setPlaying(false);
  }

  /** Plays the song from where it is (or the start). Must run inside a tap. */
  function playSong() {
    let song = songRef.current;
    if (!song) {
      song = new Audio(SONG_URL);
      song.addEventListener("play", () => setPlaying(true));
      song.addEventListener("pause", () => setPlaying(false));
      song.addEventListener("ended", () => setPlaying(false));
      songRef.current = song;
    }
    if (song.ended) song.currentTime = 0;
    // A blocked or missing song must never block the card.
    song.play().catch(() => setPlaying(false));
  }

  function openCard() {
    playSong();
    setStage("opening");
    openTimer.current = setTimeout(() => setStage("open"), OPENING_MS);
  }

  function toggleSong() {
    if (playing) songRef.current?.pause();
    else playSong();
  }

  function close() {
    stopSong();
    setStage("sealed");
    setAlert(null);
    const rest = new URLSearchParams(params.toString());
    rest.delete("birthday");
    const query = rest.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  const name = String(alert?.data.employee_name ?? "");
  const isSelf = alert?.data.is_self === true;
  const today = new Date().toLocaleDateString(dateLocale(lang), { weekday: "long", day: "numeric", month: "long" });

  return (
    <Dialog open={!!employeeId && !!alert} onOpenChange={(open) => !open && close()}>
      <DialogContent showCloseButton={false} className="gap-0 overflow-hidden p-0 text-center sm:max-w-sm">
        {stage !== "open" ? (
          // Step 1: the sealed envelope.
          <div className="relative flex flex-col items-center bg-linear-to-b from-rose-50 to-amber-50 px-6 pt-24 pb-6 dark:from-rose-950/40 dark:to-amber-950/30">
            <Sparkles aria-hidden className="absolute top-6 left-8 size-6 text-amber-400/70" />
            <Star aria-hidden className="absolute top-10 right-10 size-4 fill-rose-300/60 text-rose-300/60" />
            <Gift aria-hidden className="absolute top-16 left-1/4 size-5 -rotate-12 text-rose-300/70" />

            <Envelope opening={stage === "opening"} />

            <DialogTitle className="mt-8 text-xl font-bold tracking-tight">
              {isSelf ? t("employees.celebration.envelopeSelf") : t("employees.celebration.envelopeOther", { name })}
            </DialogTitle>
            <DialogDescription className="mt-1.5 text-sm text-muted-foreground">{t("employees.celebration.envelopeHint")}</DialogDescription>

            <Button
              className="mt-6 h-11 w-full rounded-full bg-linear-to-r from-rose-500 to-amber-500 text-white shadow-lg shadow-rose-500/25 hover:opacity-95"
              onClick={openCard}
              disabled={stage === "opening"}
            >
              <MailOpen className="size-4" />
              {t("employees.celebration.openCard")}
            </Button>
          </div>
        ) : (
          // Step 2: the card itself, with the song playing.
          <div className="motion-safe:animate-in motion-safe:fade-in-0 motion-safe:zoom-in-90 duration-500">
            {/* The card's front: a festive band with a pattern, icons and falling confetti. */}
            <div className="relative h-36 overflow-hidden bg-linear-to-br from-rose-500 via-pink-500 to-amber-400">
              <svg aria-hidden className="pointer-events-none absolute inset-0 size-full">
                <defs>
                  <pattern id="birthday-band" width="34" height="34" patternUnits="userSpaceOnUse" patternTransform="rotate(18)">
                    <circle cx="5" cy="5" r="2" fill="white" fillOpacity="0.25" />
                    <path d="M22 16v8M18 20h8" stroke="white" strokeOpacity="0.22" strokeWidth="1.6" strokeLinecap="round" />
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#birthday-band)" />
                <g fill="none" stroke="white" strokeOpacity="0.18" strokeWidth="1.5">
                  <circle cx="0" cy="100%" r="70" />
                  <circle cx="100%" cy="0" r="90" />
                </g>
              </svg>
              <Confetti />
              <Gift aria-hidden className="absolute top-5 left-6 size-9 -rotate-12 text-white/35" />
              <Sparkles aria-hidden className="absolute top-4 right-14 size-7 text-white/45" />
              <Star aria-hidden className="absolute right-16 bottom-8 size-4 fill-white/30 text-white/30" />
              <Heart aria-hidden className="absolute bottom-9 left-16 size-4 fill-white/30 text-white/30" />

              {/* Song on/off. */}
              <button
                type="button"
                onClick={toggleSong}
                aria-label={playing ? t("employees.celebration.soundOff") : t("employees.celebration.soundOn")}
                title={playing ? t("employees.celebration.soundOff") : t("employees.celebration.soundOn")}
                className="absolute top-3 right-3 flex size-9 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-sm transition hover:bg-white/30 focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"
              >
                {playing ? <Volume2 className="size-4 motion-safe:animate-pulse" /> : <VolumeX className="size-4" />}
              </button>
            </div>

            <div className="relative flex flex-col items-center px-6 pb-6">
              <div className="-mt-12 flex size-24 items-center justify-center rounded-full bg-background shadow-xl">
                <div className="flex size-20 items-center justify-center rounded-full bg-linear-to-br from-rose-500 to-amber-400 text-white">
                  {isSelf ? <Cake className="size-10" /> : <PartyPopper className="size-10" />}
                </div>
              </div>

              <p className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
                <CalendarDays className="size-3.5" />
                {today}
              </p>

              <DialogTitle className="mt-3 flex flex-col gap-0.5">
                <span className="text-sm font-medium text-muted-foreground">{isSelf ? t("employees.celebration.happyBirthday") : t("employees.celebration.weCelebrate")}</span>
                <span className="bg-linear-to-r from-rose-500 via-pink-500 to-amber-500 bg-clip-text text-2xl font-bold tracking-tight text-transparent">
                  {name}
                </span>
              </DialogTitle>

              <div aria-hidden className="my-4 flex items-center gap-3 text-rose-400">
                <span className="h-px w-12 bg-linear-to-r from-transparent to-rose-300" />
                <Heart className="size-4 fill-current" />
                <span className="h-px w-12 bg-linear-to-l from-transparent to-rose-300" />
              </div>

              <DialogDescription className="max-w-xs text-sm leading-relaxed text-muted-foreground">
                {isSelf
                  ? t("employees.celebration.selfMessage")
                  : t("employees.celebration.otherMessage", { name })}
              </DialogDescription>

              <Button
                className="mt-6 h-11 w-full rounded-full bg-linear-to-r from-rose-500 to-amber-500 text-white shadow-lg shadow-rose-500/25 hover:opacity-95"
                onClick={close}
              >
                {isSelf ? <Heart className="size-4" /> : <PartyPopper className="size-4" />}
                {isSelf ? t("employees.celebration.thanks") : t("employees.celebration.gotIt")}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// useSearchParams needs a Suspense boundary so pages can still be prerendered.
export function BirthdayCelebration() {
  return (
    <Suspense>
      <BirthdayCelebrationContent />
    </Suspense>
  );
}
