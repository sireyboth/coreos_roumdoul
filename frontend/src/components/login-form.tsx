"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AuthLayout } from "@/components/auth-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { api, ApiError, setToken } from "@/lib/api";
import { Alert } from "@/components/ui/alert";

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
  // Either an email, or a company code + employee ID. A company link means the latter.
  const [method, setMethod] = useState<"email" | "employee_id">(linkedCompany ? "employee_id" : "email");
  const [email, setEmail] = useState("");
  const [typedCompany, setTypedCompany] = useState("");
  const company = linkedCompany ?? typedCompany;
  const [employeeId, setEmployeeId] = useState("");
  const [password, setPassword] = useState("");
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
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout>
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="text-xl">Sign in</CardTitle>
          <CardDescription>Welcome back — sign in with your email or your employee ID.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1 text-sm font-medium" role="tablist">
              {(
                [
                  { id: "email", label: "Email" },
                  { id: "employee_id", label: "Employee ID" },
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
                    method === tab.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {method === "email" ? (
              <div className="flex flex-col gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                />
              </div>
            ) : (
              <>
                {linkedCompany ? (
                  <p className="text-sm text-muted-foreground">
                    Signing in to <strong className="text-foreground">{linkedCompany}</strong>.{" "}
                    <Link href="/login" className="font-medium text-primary hover:underline">
                      Not your company?
                    </Link>
                  </p>
                ) : (
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="company">Company code</Label>
                    <Input
                      id="company"
                      required
                      placeholder="e.g. acme-x9k2"
                      value={company}
                      onChange={(e) => setTypedCompany(e.target.value)}
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                    />
                    <p className="text-xs text-muted-foreground">Your manager can tell you this.</p>
                  </div>
                )}
                <div className="flex flex-col gap-2">
                  <Label htmlFor="employee_id">Employee ID</Label>
                  <Input
                    id="employee_id"
                    required
                    placeholder="e.g. E-001"
                    value={employeeId}
                    onChange={(e) => setEmployeeId(e.target.value)}
                    autoComplete="username"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                  />
                </div>
              </>
            )}
            <div className="flex flex-col gap-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>
            {error && <Alert variant="destructive">{error}</Alert>}
            <Button type="submit" disabled={loading} className="mt-1">
              {loading ? "Signing in…" : "Sign in"}
            </Button>
          </form>
          <p className="mt-5 text-center text-sm text-muted-foreground">
            Don&apos;t have an account?{" "}
            <Link href="/signup" className="font-medium text-primary hover:underline">
              Create one
            </Link>
          </p>
        </CardContent>
      </Card>
    </AuthLayout>
  );
}
