"use client";

import { useEffect, useRef, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * An employee's ID card, front and back, drawn from the same template as the
 * printable PDF (GET /api/employees/{id}/card/preview) — so it looks like the
 * card itself, not a PDF viewer.
 *
 * The HTML goes into a shadow root: its styles can't leak into the app (or
 * the app's into it), it takes its natural height so the page scrolls as
 * usual, and it has no backdrop of its own. (An iframe did neither on iPhone:
 * an opaque black box in dark mode, and a height that had to be measured.)
 * Markup set through innerHTML never runs scripts, and the template has none.
 */
export function IdCardView({ employeeId, className }: { employeeId: number; className?: string }) {
  const t = useT();
  const host = useRef<HTMLDivElement>(null);
  // Keyed on the employee, so switching employees shows "loading" until the new card arrives.
  const [card, setCard] = useState<{ id: number; html: string } | { id: number; error: string } | null>(null);

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

  const current = card?.id === employeeId ? card : null;
  const html = current && "html" in current ? current.html : null;

  useEffect(() => {
    const el = host.current;
    if (!el || html === null) return;
    const root = el.shadowRoot ?? el.attachShadow({ mode: "open" });
    root.innerHTML = html;
  }, [html]);

  if (current && "error" in current) {
    return <p className="py-10 text-center text-sm text-destructive">{current.error}</p>;
  }

  return (
    <div className={cn("min-h-40", className)}>
      {!current && <p className="py-16 text-center text-sm text-muted-foreground">{t("employees.shared.preparing")}</p>}
      <div ref={host} role="img" aria-label={t("employees.idCards.preview")} hidden={!html} />
    </div>
  );
}
