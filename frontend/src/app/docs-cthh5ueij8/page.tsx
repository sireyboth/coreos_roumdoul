"use client";

import Link from "next/link";
import { ArrowRight, CalendarClock, ClipboardList, Users, Wallet } from "lucide-react";
import { useT, type TKey } from "@/lib/i18n";

const MODULES: { href: string | null; title: TKey; text: TKey; icon: typeof Wallet; ready: boolean }[] = [
  { href: "/docs-cthh5ueij8/payroll", title: "docs.home.payroll", text: "docs.home.payrollText", icon: Wallet, ready: true },
  { href: null, title: "docs.home.attendance", text: "docs.home.attendanceText", icon: CalendarClock, ready: false },
  { href: null, title: "docs.home.leave", text: "docs.home.leaveText", icon: ClipboardList, ready: false },
  { href: null, title: "docs.home.employees", text: "docs.home.employeesText", icon: Users, ready: false },
];

export default function DocsHome() {
  const t = useT();
  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight">{t("docs.home.title")}</h1>
      <p className="mt-2 max-w-2xl text-muted-foreground">{t("docs.home.intro")}</p>
      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {MODULES.map((m) => {
          const body = (
            <>
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <m.icon className="size-5" />
                </span>
                <div className="flex-1">
                  <p className="font-semibold">{t(m.title)}</p>
                  <p className="text-sm text-muted-foreground">{t(m.text)}</p>
                </div>
                {m.ready ? <ArrowRight className="size-4 text-muted-foreground" /> : <span className="text-xs text-muted-foreground">{t("docs.home.comingSoon")}</span>}
              </div>
            </>
          );
          return m.href ? (
            <Link key={m.title} href={m.href} className="rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary/50">
              {body}
            </Link>
          ) : (
            <div key={m.title} className="rounded-xl border border-dashed border-border p-5 opacity-60">
              {body}
            </div>
          );
        })}
      </div>
    </main>
  );
}
