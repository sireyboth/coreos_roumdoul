"use client";

import { Building2, Globe2 } from "lucide-react";
import type { TelegramDetail } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export type BranchOption = { id: number; name: string };

/**
 * Which branches a Telegram group covers: every branch (null) or chosen ones.
 * Used when connecting a group and when managing one.
 */
export function TelegramReachPicker({
  branches,
  value,
  onChange,
}: {
  branches: BranchOption[];
  value: number[] | null;
  onChange: (value: number[] | null) => void;
}) {
  const t = useT();
  const some = value !== null;

  function toggle(id: number, on: boolean) {
    const current = value ?? [];
    onChange(on ? [...current, id] : current.filter((b) => b !== id));
  }

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-sm font-medium">{t("access.telegramPage.reachLabel")}</legend>
      <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label={t("access.telegramPage.reachLabel")}>
        <Choice icon={Globe2} active={!some} onSelect={() => onChange(null)} label={t("access.telegramPage.reachAll")} hint={t("access.telegramPage.reachAllHint")} />
        <Choice icon={Building2} active={some} onSelect={() => onChange(value ?? [])} label={t("access.telegramPage.reachSome")} hint={t("access.telegramPage.reachSomeHint")} />
      </div>

      {some && (
        <div className="mt-1 flex flex-col gap-1 rounded-lg border p-2">
          {branches.map((branch) => (
            <label key={branch.id} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted/60">
              <input
                type="checkbox"
                className="size-4 rounded border-input"
                checked={value.includes(branch.id)}
                onChange={(e) => toggle(branch.id, e.target.checked)}
              />
              {branch.name}
            </label>
          ))}
          {value.length === 0 && <p className="px-2 pt-1 text-xs text-destructive">{t("access.telegramPage.pickBranch")}</p>}
        </div>
      )}
    </fieldset>
  );
}

/** How much of the employee a group's posts show. */
export function TelegramDetailPicker({ value, onChange }: { value: TelegramDetail; onChange: (value: TelegramDetail) => void }) {
  const t = useT();
  const options: TelegramDetail[] = ["full", "basic"];

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-sm font-medium">{t("access.telegramPage.detailLabel")}</legend>
      <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1 text-sm" role="radiogroup" aria-label={t("access.telegramPage.detailLabel")}>
        {options.map((option) => (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={value === option}
            onClick={() => onChange(option)}
            className={cn(
              "truncate rounded-md px-3 py-1.5 font-medium transition-colors",
              value === option ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t(`access.telegramPage.detail.${option}.label`)}
          </button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">{t(`access.telegramPage.detail.${value}.hint`)}</p>
    </fieldset>
  );
}

/** "All branches" / "Riverside" / "3 branches" — a group's reach in one short label. */
export function reachLabel(t: ReturnType<typeof useT>, branchIds: number[] | null, branches: BranchOption[]): string {
  if (branchIds === null) return t("access.telegramPage.allBranches");
  const names = branches.filter((b) => branchIds.includes(b.id)).map((b) => b.name);
  if (names.length === 1) return names[0];
  return t("access.telegramPage.branchCount", { n: branchIds.length });
}

function Choice({
  icon: Icon,
  active,
  onSelect,
  label,
  hint,
}: {
  icon: typeof Globe2;
  active: boolean;
  onSelect: () => void;
  label: string;
  hint: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onSelect}
      className={cn(
        "flex items-start gap-3 rounded-lg border p-3 text-left transition-colors",
        active ? "border-sky-500/50 bg-sky-500/5 ring-1 ring-sky-500/20" : "hover:bg-muted/50",
      )}
    >
      <Icon className={cn("mt-0.5 size-4 shrink-0", active ? "text-sky-600 dark:text-sky-400" : "text-muted-foreground")} />
      <span className="flex flex-col gap-0.5">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-xs text-muted-foreground">{hint}</span>
      </span>
    </button>
  );
}
