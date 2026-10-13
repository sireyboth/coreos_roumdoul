"use client";

import { Suspense, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Cake, PartyPopper } from "lucide-react";
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
      <DialogContent className="overflow-hidden text-center sm:max-w-md">
        <Confetti />
        <div className="relative flex flex-col items-center gap-3 pt-6 pb-1">
          <div className="flex size-16 items-center justify-center rounded-full bg-linear-to-br from-rose-500 to-amber-400 text-white shadow-lg shadow-rose-500/25">
            {isSelf ? <Cake className="size-8" /> : <PartyPopper className="size-8" />}
          </div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{today}</p>
          <DialogTitle className="text-xl font-semibold">{isSelf ? `Happy birthday, ${name}` : `It's ${name}'s birthday`}</DialogTitle>
          <DialogDescription className="max-w-xs text-sm text-muted-foreground">
            {isSelf
              ? "On behalf of the whole team, we wish you a wonderful day and a successful year ahead. Thank you for everything you bring to the team."
              : `Today is a special day for ${name}. Take a moment to share your best wishes.`}
          </DialogDescription>
          <Button className="mt-3 w-full sm:w-auto sm:min-w-32" onClick={close}>
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
