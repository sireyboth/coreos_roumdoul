"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Building2, Check, Eye, EyeOff, IdCard, Loader2, Lock, Mail, ShieldCheck, type LucideIcon } from "lucide-react";
import { AuthLayout } from "@/components/auth-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, ApiError, setToken } from "@/lib/api";
import { Alert } from "@/components/ui/alert";
import { translateNow, useT } from "@/lib/i18n";

/**
 * The sign-in form, shared by /login (generic, company typed by hand or via
 * ?company=) and /c/[company]/login (an admin's shareable link, company baked
 * into the path so it survives "Add to Home Screen" the way a query string
 * doesn't). The path alone isn't the whole fix, though: installed PWAs
 * relaunch at their manifest's start_url regardless of the URL installed
 * from, which is why /c/[company]/ has its own manifest with its own
 * start_url (see that route's layout.tsx) instead of the app's global one.
 */
export function LoginForm({ linkedCompany = null }: { linkedCompany?: string | null }) {
  const router = useRouter();
  const t = useT();
  // Either an email, or a company code + employee ID. A company link means the latter.
  const [method, setMethod] = useState<"email" | "employee_id">(linkedCompany ? "employee_id" : "email");
  const [email, setEmail] = useState("");
  const [typedCompany, setTypedCompany] = useState("");
  const company = linkedCompany ?? typedCompany;
  const [employeeId, setEmployeeId] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [signedIn, setSignedIn] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { token } = await api.login(
        method === "email" ? { email, password } : { company, employee_id: employeeId, password },
      );
      setToken(token);
      setSignedIn(true);
      // Load the dashboard in the background while the success screen plays,
      // so the short pause doesn't make the whole sign-in slower.
      router.prefetch("/dashboard");
      setTimeout(() => router.push("/dashboard"), SUCCESS_DELAY_MS);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : translateNow("common.message.somethingWrong"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout>
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">{t("app.auth.signIn.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("app.auth.signIn.description")}</p>
      </div>

      <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-5">
        <div className="relative grid grid-cols-2 rounded-xl border bg-muted/60 p-1 text-sm font-medium lg:rounded-lg" role="tablist">
          {/* One white pill that slides between the tabs, instead of each tab toggling its own background.
              Width is half the strip minus the p-1 padding; translate-x-full moves it exactly one tab over. */}
          <span
            aria-hidden
            className={`absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded-lg bg-background shadow-sm transition-transform duration-300 ease-out motion-reduce:transition-none lg:rounded-md ${
              method === "employee_id" ? "translate-x-full" : ""
            }`}
          />
          {(
            [
              { id: "email", label: t("app.auth.signIn.email") },
              { id: "employee_id", label: t("app.auth.signIn.employeeId") },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={method === tab.id}
              onClick={() => {
                setMethod(tab.id);
                setError(null);
              }}
              className={`relative px-3 py-2 transition-colors duration-300 lg:py-1.5 ${
                method === tab.id ? "text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* key={method} remounts this block on every switch, which replays the enter animation.
            It slides in from the side of the tab you picked: Email is left, Employee ID is right. */}
        <div
          key={method}
          className={`flex flex-col gap-5 duration-300 ease-out animate-in fade-in-0 motion-reduce:animate-none ${
            method === "email" ? "slide-in-from-left-4" : "slide-in-from-right-4"
          }`}
        >
          {method === "email" ? (
            <Field id="email" label={t("app.auth.signIn.email")}>
              <IconInput
                icon={Mail}
                id="email"
                type="email"
                required
                placeholder="name@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </Field>
          ) : (
            <>
              {linkedCompany ? (
                <p className="rounded-lg border bg-muted/40 px-3 py-2.5 text-sm text-muted-foreground">
                  {t("app.auth.signIn.signingInTo")} <strong className="text-foreground">{linkedCompany}</strong>
                  {t("app.auth.signIn.signingInEnd")}{" "}
                  <Link href="/login" className="font-medium text-primary hover:underline">
                    {t("app.auth.signIn.notYourCompany")}
                  </Link>
                </p>
              ) : (
                <Field id="company" label={t("app.auth.signIn.companyCode")} hint={t("app.auth.signIn.companyCodeHint")}>
                  <IconInput
                    icon={Building2}
                    id="company"
                    required
                    placeholder={t("app.auth.signIn.companyCodePlaceholder")}
                    value={company}
                    onChange={(e) => setTypedCompany(e.target.value)}
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                  />
                </Field>
              )}
              <Field id="employee_id" label={t("app.auth.signIn.employeeId")}>
                <IconInput
                  icon={IdCard}
                  id="employee_id"
                  required
                  placeholder={t("app.auth.signIn.employeeIdPlaceholder")}
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                  autoComplete="username"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                />
              </Field>
            </>
          )}
        </div>

        <Field id="password" label={t("app.auth.signIn.password")}>
          <div className="relative">
            <IconInput
              icon={Lock}
              id="password"
              type={showPassword ? "text" : "password"}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              className="pr-11 lg:pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? t("app.auth.signIn.hidePassword") : t("app.auth.signIn.showPassword")}
              className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-xl text-muted-foreground transition-colors hover:text-foreground lg:w-10 lg:rounded-r-lg"
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </Field>

        {error && (
          <div className="duration-200 animate-in fade-in-0 slide-in-from-top-1 motion-reduce:animate-none">
            <Alert variant="destructive">{error}</Alert>
          </div>
        )}

        <Button type="submit" disabled={loading || signedIn} className="h-12 w-full rounded-xl text-base lg:h-10 lg:rounded-lg lg:text-sm">
          {signedIn ? (
            <>
              <Check className="size-4" />
              {t("app.auth.signIn.success")}
            </>
          ) : (
            <>
              {loading && <Loader2 className="size-4 animate-spin" />}
              {loading ? t("app.auth.signIn.submitting") : t("common.action.signIn")}
            </>
          )}
        </Button>
      </form>

      <div className="mt-6 flex flex-col gap-4 border-t pt-6 lg:mt-8">
        <p className="text-center text-sm text-muted-foreground">
          {t("app.auth.signIn.noAccount")}{" "}
          <Link href="/signup" className="font-medium text-primary hover:underline">
            {t("app.auth.signIn.createOne")}
          </Link>
        </p>
        {/* Icon inline with the text, so it stays beside the first word when the note wraps. */}
        <p className="text-center text-xs text-muted-foreground">
          <ShieldCheck className="mr-1 -mt-0.5 inline size-3.5" aria-hidden />
          {t("app.auth.signIn.secureNote")}
        </p>
      </div>

      {signedIn && <SignedInScreen />}
    </AuthLayout>
  );
}

// How long the success screen shows before opening the dashboard. The
// progress bar below runs for the same time, so keep the two in step.
const SUCCESS_DELAY_MS = 900;

/** Full-screen "signed in" moment: check mark pops in, bar fills, then the dashboard opens. */
function SignedInScreen() {
  const t = useT();
  return (
    <div
      role="status"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-5 bg-background/95 px-6 text-center backdrop-blur-sm duration-300 animate-in fade-in-0 motion-reduce:animate-none"
    >
      <div className="flex size-16 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg delay-100 duration-500 animate-in fill-mode-both zoom-in-50 motion-reduce:animate-none">
        <Check className="size-8" strokeWidth={2.5} />
      </div>
      <div className="flex flex-col gap-1">
        <p className="text-lg font-semibold tracking-tight">{t("app.auth.signIn.success")}</p>
        <p className="text-sm text-muted-foreground">{t("app.auth.signIn.redirecting")}</p>
      </div>
      <div className="h-1 w-40 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full w-full rounded-full bg-primary ease-out animate-in slide-in-from-left-full motion-reduce:animate-none"
          style={{ animationDuration: `${SUCCESS_DELAY_MS}ms` }}
        />
      </div>
    </div>
  );
}

function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

// Taller input with a leading icon, for the sign-in form only. Phone sizes
// (48px, rounded-xl) match native app fields; lg: drops back to desktop size.
function IconInput({ icon: Icon, className, ...props }: React.ComponentProps<typeof Input> & { icon: LucideIcon }) {
  return (
    <div className="relative">
      <Icon className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground lg:left-3" aria-hidden />
      <Input className={`h-12 rounded-xl pl-10 lg:h-10 lg:rounded-lg lg:pl-9 ${className ?? ""}`} {...props} />
    </div>
  );
}
