"use client";

import { useEffect, useRef, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * An employee's ID card, front and back, drawn from the same template as the
 * printable PDF (GET /api/employees/{id}/card/preview) — so it looks like the
 * card itself, not a PDF viewer. The HTML sits in a sandboxed frame (no
 * scripts run in it) that grows to fit the card, whether the two sides sit
 * side by side or stack on a narrow screen.
 */
export function IdCardView({ employeeId, className }: { employeeId: number; className?: string }) {
  const t = useT();
  const frame = useRef<HTMLIFrameElement>(null);
  // Keyed on the employee, so switching employees shows "loading" until the new card arrives.
  const [card, setCard] = useState<{ id: number; html: string } | { id: number; error: string } | null>(null);
  const [height, setHeight] = useState(0);

  useEffect(() => {
    let cancelled = false;
    api.employees
      .cardPreview(employeeId)
      .then((html) => !cancelled && setCard({ id: employeeId, html }))
      .catch((err) => !cancelled && setCard({ id: employeeId, error: err instanceof ApiError ? err.message : t("common.message.somethingWrong") }));
    return () => {
      cancelled = true;
    };
  }, [employeeId, t]);

  // Re-measure whenever the frame's width changes (the sides may wrap).
  useEffect(() => {
    const el = frame.current;
    if (!el) return;
    // Before the card has loaded, the frame's document can still be empty (no root element yet).
    const measure = () => {
      const fit = el.contentDocument?.documentElement?.scrollHeight;
      if (fit) setHeight(fit);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    el.addEventListener("load", measure);
    return () => {
      observer.disconnect();
      el.removeEventListener("load", measure);
    };
  }, [card]);

  const current = card?.id === employeeId ? card : null;

  if (current && "error" in current) {
    return <p className="py-10 text-center text-sm text-destructive">{current.error}</p>;
  }

  return (
    <div className={cn("relative min-h-40", className)}>
      {!current && <p className="py-16 text-center text-sm text-muted-foreground">{t("employees.shared.preparing")}</p>}
      {current && (
        <iframe
          ref={frame}
          // allow-same-origin only so the frame's height can be read; without allow-scripts nothing in it runs.
          sandbox="allow-same-origin"
          srcDoc={current.html}
          title={t("employees.idCards.preview")}
          className="block w-full border-0"
          style={{ height: height || 520 }}
        />
      )}
    </div>
  );
}
