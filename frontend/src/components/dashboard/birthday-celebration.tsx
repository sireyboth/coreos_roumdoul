"use client";

import { Suspense, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Cake, CalendarDays, Gift, Heart, PartyPopper, Sparkles, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { api, type Notification } from "@/lib/api";

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
 * The birthday celebration: opened by a birthday alert (bell or push), whose
 * link is /dashboard?birthday={employee_id}. Its content comes from the
 * signed-in person's own alert, so nobody sees a birthday they weren't told about.
 */
function BirthdayCelebrationContent() {
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const employeeId = params.get("birthday");
  const [alert, setAlert] = useState<Notification | null>(null);

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

  function close() {
    setAlert(null);
    const rest = new URLSearchParams(params.toString());
    rest.delete("birthday");
    const query = rest.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  const name = String(alert?.data.employee_name ?? "");
  const isSelf = alert?.data.is_self === true;
  const today = new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });

  return (
    <Dialog open={!!employeeId && !!alert} onOpenChange={(open) => !open && close()}>
      <DialogContent showCloseButton={false} className="gap-0 overflow-hidden p-0 text-center sm:max-w-sm">
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
          <Sparkles aria-hidden className="absolute top-4 right-8 size-7 text-white/45" />
          <Star aria-hidden className="absolute right-16 bottom-8 size-4 fill-white/30 text-white/30" />
          <Heart aria-hidden className="absolute bottom-9 left-16 size-4 fill-white/30 text-white/30" />
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
            <span className="text-sm font-medium text-muted-foreground">{isSelf ? "Happy birthday," : "Today we celebrate"}</span>
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
              ? "On behalf of the whole team, we wish you a wonderful day and a successful year ahead. Thank you for everything you bring to the team."
              : `Today is a special day for ${name}. Take a moment to share your best wishes.`}
          </DialogDescription>

          <Button
            className="mt-6 h-11 w-full rounded-full bg-linear-to-r from-rose-500 to-amber-500 text-white shadow-lg shadow-rose-500/25 hover:opacity-95"
            onClick={close}
          >
            {isSelf ? <Heart className="size-4" /> : <PartyPopper className="size-4" />}
            {isSelf ? "Thank you" : "Got it"}
          </Button>
        </div>
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
