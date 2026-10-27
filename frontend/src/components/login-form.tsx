"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Building2, Eye, EyeOff, IdCard, Loader2, Lock, Mail, ShieldCheck, type LucideIcon } from "lucide-react";
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { token } = await api.login(
        method === "email" ? { email, password } : { company, employee_id: employeeId, password },
      );
      setToken(token);
      router.push("/dashboard");
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
        <div className="grid grid-cols-2 gap-1 rounded-lg border bg-muted/60 p-1 text-sm font-medium" role="tablist">
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
              className={`rounded-md px-3 py-1.5 transition-colors ${
                method === tab.id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

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
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? t("app.auth.signIn.hidePassword") : t("app.auth.signIn.showPassword")}
              className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-lg text-muted-foreground transition-colors hover:text-foreground"
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </Field>

        {error && <Alert variant="destructive">{error}</Alert>}

        <Button type="submit" disabled={loading} className="h-10 w-full">
          {loading && <Loader2 className="size-4 animate-spin" />}
          {loading ? t("app.auth.signIn.submitting") : t("common.action.signIn")}
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
    </AuthLayout>
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

// Taller input with a leading icon, for the sign-in form only.
function IconInput({ icon: Icon, className, ...props }: React.ComponentProps<typeof Input> & { icon: LucideIcon }) {
  return (
    <div className="relative">
      <Icon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
      <Input className={`h-10 pl-9 ${className ?? ""}`} {...props} />
    </div>
  );
}
