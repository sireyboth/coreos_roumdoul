"use client";

import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type PillTab<T extends string> = { id: T; label: string; icon: LucideIcon };

/**
 * The app's page tabs: a row of pill buttons with icons (employee profile,
 * payroll settings, leave policy). Scrolls sideways on a phone. ← / → move
 * between tabs, like a native tab bar.
 */
export function PillTabs<T extends string>({ tabs, value, onChange, className }: { tabs: PillTab<T>[]; value: T; onChange: (id: T) => void; className?: string }) {
  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const index = tabs.findIndex((tab) => tab.id === value);
    const next = tabs[(index + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length];
    onChange(next.id);
    // Move focus with the selection.
    (e.currentTarget.querySelector(`[data-tab="${next.id}"]`) as HTMLButtonElement | null)?.focus();
  }

  return (
    <div className={cn("-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0", className)}>
      <div className="inline-flex rounded-lg border border-border bg-card p-0.5 shadow-sm" role="tablist" onKeyDown={onKeyDown}>
        {tabs.map((tab) => {
          const selected = tab.id === value;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              data-tab={tab.id}
              aria-selected={selected}
              // Only the chosen tab is in the Tab order; arrows reach the rest.
              tabIndex={selected ? 0 : -1}
              onClick={() => onChange(tab.id)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-sm font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                selected ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <tab.icon className="size-4" />
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
