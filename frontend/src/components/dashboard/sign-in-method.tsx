"use client";

import { IdCard, Mail } from "lucide-react";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n";

export type SignInMethod = "email" | "employee_id";

const OPTIONS: { value: SignInMethod; labelKey: "email" | "employeeId"; icon: typeof Mail }[] = [
  { value: "email", labelKey: "email", icon: Mail },
  { value: "employee_id", labelKey: "employeeId", icon: IdCard },
];

/**
 * Pick exactly ONE way for this employee to sign in. It's a radio group on
 * purpose: choosing one switches the other off, so there's never an email and
 * an ID competing to be "the" login.
 */
export function SignInMethodPicker({
  value,
  onChange,
  name = "sign-in-method",
}: {
  value: SignInMethod;
  onChange: (method: SignInMethod) => void;
  name?: string;
}) {
  const t = useT();
  return (
    <fieldset className="grid gap-2 sm:grid-cols-2">
      <legend className="sr-only">{t("access.signInMethod.legend")}</legend>
      {OPTIONS.map((option) => {
        const selected = value === option.value;

        return (
          <label
            key={option.value}
            className={cn(
              "flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors",
              selected ? "border-primary bg-primary/5 ring-1 ring-primary/30" : "border-border hover:bg-muted/50",
            )}
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={selected}
              onChange={() => onChange(option.value)}
              className="sr-only"
            />
            <span
              className={cn(
                "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md",
                selected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
              )}
            >
              <option.icon className="size-4" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-medium">{t(`access.signInMethod.${option.labelKey}`)}</span>
              <span className="block text-xs text-muted-foreground">{t(`access.signInMethod.${option.labelKey}Hint`)}</span>
            </span>
          </label>
        );
      })}
    </fieldset>
  );
}
