"use client";

import { useEffect, useState } from "react";
import { RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n";

// How long a load may run before we offer a way out.
const SLOW_AFTER_MS = 10_000;

/**
 * Goes under a loading spinner: after 10 seconds it says the load is slow and
 * offers "Try again", which reloads the page (a fresh start fixes a request
 * that hung, a dropped connection or a server that was restarting). Shows
 * nothing before that. Only for loading data — never under a save, where a
 * reload could lose what is being saved.
 */
export function SlowLoadRetry() {
  const t = useT();
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setSlow(true), SLOW_AFTER_MS);
    return () => clearTimeout(timer);
  }, []);

  if (!slow) return null;

  return (
    <div className="pointer-events-auto flex flex-col items-center gap-2.5 motion-safe:animate-in motion-safe:fade-in-0 duration-300">
      <p className="max-w-56 text-center text-xs font-normal text-muted-foreground">{t("common.message.takingLong")}</p>
      <Button size="sm" variant="outline" onClick={() => window.location.reload()}>
        <RotateCw />
        {t("common.action.retry")}
      </Button>
    </div>
  );
}
