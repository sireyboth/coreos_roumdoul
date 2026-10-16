import Link from "next/link";
import { ArrowRight, CalendarClock, ClipboardList, Users, Wallet } from "lucide-react";

const MODULES = [
  { href: "/docs-cthh5ueij8/payroll", title: "Payroll", text: "Salaries, pay groups, pay runs, payslips, adjustments — step by step.", icon: Wallet, ready: true },
  { href: null, title: "Attendance", text: "Schedules, scans, corrections, month close.", icon: CalendarClock, ready: false },
  { href: null, title: "Leave & requests", text: "Leave types, balances, approvals.", icon: ClipboardList, ready: false },
  { href: null, title: "Employees", text: "Profiles, branches, roles and access.", icon: Users, ready: false },
];

export default function DocsHome() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight">How Business OS works</h1>
      <p className="mt-2 max-w-2xl text-muted-foreground">Guides for the people who run HR and payroll. Pick a topic.</p>
      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {MODULES.map((m) => {
          const body = (
            <>
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <m.icon className="size-5" />
                </span>
                <div className="flex-1">
                  <p className="font-semibold">{m.title}</p>
                  <p className="text-sm text-muted-foreground">{m.text}</p>
                </div>
                {m.ready ? <ArrowRight className="size-4 text-muted-foreground" /> : <span className="text-xs text-muted-foreground">Coming soon</span>}
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
