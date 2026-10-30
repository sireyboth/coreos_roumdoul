"use client";

import { useState } from "react";
import { Eye, EyeOff, Lock, type LucideIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

// Form pieces shared by sign in (components/login-form.tsx) and sign up (app/signup/page.tsx).

export function Field({ id, label, hint, children }: { id: string; label: string; hint?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

// Taller input with a leading icon. Phone sizes (48px, rounded-xl) match native
// app fields; lg: drops back to desktop size. The icon turns primary while the
// field has focus, so it's clear where you're typing.
export function IconInput({ icon: Icon, className, ...props }: React.ComponentProps<typeof Input> & { icon: LucideIcon }) {
  return (
    <div className="group relative">
      <Icon
        className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary lg:left-3"
        aria-hidden
      />
      <Input className={cn("h-12 rounded-xl bg-background pl-10 lg:h-11 lg:rounded-lg lg:pl-9", className)} {...props} />
    </div>
  );
}

/** Password field with a show / hide eye button. */
export function PasswordInput(props: Omit<React.ComponentProps<typeof Input>, "type">) {
  const t = useT();
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <IconInput icon={Lock} type={show ? "text" : "password"} className="pr-11 lg:pr-10" {...props} />
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        aria-label={show ? t("app.auth.signIn.hidePassword") : t("app.auth.signIn.showPassword")}
        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-xl text-muted-foreground transition-colors hover:text-foreground lg:w-10 lg:rounded-r-lg"
      >
        {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}
