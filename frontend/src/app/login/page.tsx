"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { LoginForm } from "@/components/login-form";

// useSearchParams needs a Suspense boundary above it, so the page is a thin
// wrapper and the real form lives in LoginForm. This route stays around for
// anyone who typed a company code by hand or has an old ?company= link —
// new shareable links use /c/[company]/login instead (see that route for why).
export default function LoginPage() {
  return (
    <Suspense>
      <LoginPageInner />
    </Suspense>
  );
}

function LoginPageInner() {
  const linkedCompany = useSearchParams().get("company")?.trim().toLowerCase() || null;
  return <LoginForm linkedCompany={linkedCompany} />;
}
