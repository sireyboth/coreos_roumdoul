"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Building2, Check, Loader2, Mail, Sparkles, UserRound } from "lucide-react";
import { AuthLayout } from "@/components/auth-layout";
import { Field, IconInput, PasswordInput } from "@/components/auth-fields";
import { Button } from "@/components/ui/button";
import { api, ApiError, setToken } from "@/lib/api";
import { Alert } from "@/components/ui/alert";
import { translateNow, useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const MIN_PASSWORD = 8;

export default function SignupPage() {
  const router = useRouter();
  const t = useT();
  const [companyName, setCompanyName] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const passwordLongEnough = password.length >= MIN_PASSWORD;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { token } = await api.register(companyName, name, email, password);
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
      <div className="flex flex-col items-start gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
          <Sparkles className="size-3.5" aria-hidden />
          {t("app.auth.signUp.trial")}
        </span>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">{t("app.auth.signUp.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("app.auth.signUp.description")}</p>
      </div>

      <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-5">
        <Field id="company_name" label={t("app.auth.signUp.companyName")}>
          <IconInput
            icon={Building2}
            id="company_name"
            required
            placeholder={t("app.auth.signUp.companyNamePlaceholder")}
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            autoComplete="organization"
          />
        </Field>
        <Field id="name" label={t("app.auth.signUp.yourName")}>
          <IconInput
            icon={UserRound}
            id="name"
            required
            placeholder={t("app.auth.signUp.yourNamePlaceholder")}
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
          />
        </Field>
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
        <Field
          id="password"
          label={t("app.auth.signIn.password")}
          // Turns green with a tick once long enough, so people know before pressing submit.
          hint={
            <span className={cn("inline-flex items-center gap-1 transition-colors", passwordLongEnough && "text-emerald-600 dark:text-emerald-400")}>
              <Check className={cn("size-3.5 transition-opacity", passwordLongEnough ? "opacity-100" : "opacity-40")} aria-hidden />
              {t("app.auth.signUp.passwordHint")}
            </span>
          }
        >
          <PasswordInput
            id="password"
            required
            minLength={MIN_PASSWORD}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
          />
        </Field>

        {error && (
          <div className="duration-200 animate-in fade-in-0 slide-in-from-top-1 motion-reduce:animate-none">
            <Alert variant="destructive">{error}</Alert>
          </div>
        )}

        <Button
          type="submit"
          disabled={loading}
          className="group mt-1 h-12 w-full rounded-xl text-base shadow-lg shadow-primary/25 lg:h-11 lg:rounded-lg lg:text-sm"
        >
          {loading ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              {t("app.auth.signUp.submitting")}
            </>
          ) : (
            <>
              {t("app.auth.signUp.submit")}
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </>
          )}
        </Button>
      </form>

      <p className="mt-6 border-t pt-6 text-center text-sm text-muted-foreground lg:mt-8">
        {t("app.auth.signUp.haveAccount")}{" "}
        <Link href="/login" className="font-medium text-primary hover:underline">
          {t("common.action.signIn")}
        </Link>
      </p>
    </AuthLayout>
  );
}
