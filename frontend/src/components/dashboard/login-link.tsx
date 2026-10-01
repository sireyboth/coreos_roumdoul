"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useMe } from "@/contexts/me-context";
import { companyLoginLink } from "@/lib/login-link";
import { notifyError } from "@/lib/notify";

/** A read-only box with the company's sign-in link and a Copy button. */
export function LoginLink() {
  const { me } = useMe();
  const [copied, setCopied] = useState(false);
  const slug = me?.company?.slug;

  if (!slug) return null;

  async function copy() {
    try {
      await navigator.clipboard.writeText(companyLoginLink(slug!));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      notifyError(err);
    }
  }

  return (
    <div className="flex gap-2">
      {/* Shown as a path-less preview during SSR; the real link needs `window`. */}
      <Input readOnly value={`/c/${slug}/login`} aria-label="Sign-in link" onFocus={(e) => e.currentTarget.select()} />
      <Button type="button" variant="outline" onClick={copy}>
        {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
        {copied ? "Copied" : "Copy link"}
      </Button>
    </div>
  );
}
