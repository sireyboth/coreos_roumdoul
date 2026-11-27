"use client";

import { useState } from "react";
import type { LucideIcon } from "lucide-react";
import { AlarmClock, Building2, CalendarDays, CalendarPlus, CircleCheck, Hourglass, IdCard, PenLine, Repeat, UserRound } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TelegramDetailPicker } from "@/components/dashboard/access/telegram-group-fields";
import type { TelegramDetail } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type Sample = "request" | "decision" | "late";

type Line = { icon?: LucideIcon; text: string; indent?: boolean; strong?: boolean };

// The employee block every post starts with (backend: TelegramCard), per detail level. Example data only.
const WHO: Record<TelegramDetail, Line[]> = {
  full: [
    { icon: UserRound, text: "Dara (ដារា)", strong: true },
    { icon: IdCard, text: "X41-001 · Cook" },
    { icon: Building2, text: "Kitchen · Main branch" },
  ],
  basic: [
    { icon: UserRound, text: "Dara", strong: true },
    { icon: Building2, text: "Main branch" },
  ],
};

/**
 * Example posts, matching what the server sends (RequestNotifier,
 * LateWarningNotifier → TelegramCard). Posts are English-only, so this is
 * too. The real post marks each line with an emoji; here lucide icons stand
 * in for them, because the app itself never shows emoji.
 */
const SAMPLES: Record<Sample, { icon: LucideIcon; tone: string; heading: string; details: Line[] }> = {
  request: {
    icon: CalendarPlus,
    tone: "text-sky-600 dark:text-sky-400",
    heading: "LEAVE REQUEST",
    details: [
      { icon: CalendarDays, text: "Annual leave" },
      { text: "Wed 25 Nov – Thu 26 Nov · 2 days", indent: true },
      { icon: Hourglass, text: "Waiting for approval" },
    ],
  },
  decision: {
    icon: CircleCheck,
    tone: "text-emerald-600 dark:text-emerald-400",
    heading: "LEAVE APPROVED",
    details: [
      { icon: CalendarDays, text: "Annual leave" },
      { text: "Wed 25 Nov – Thu 26 Nov · 2 days", indent: true },
      { icon: PenLine, text: "Approved by Sokha" },
    ],
  },
  late: {
    icon: AlarmClock,
    tone: "text-amber-600 dark:text-amber-400",
    heading: "LATE WARNING",
    details: [
      { icon: Repeat, text: "Late or left early 3 times in November 2026" },
      { text: "• Mon 2 Nov — late 15 min", indent: true },
      { text: "• Wed 4 Nov — left early 20 min", indent: true },
      { text: "• Fri 6 Nov — late 8 min", indent: true },
    ],
  },
};

const ORDER: Sample[] = ["request", "decision", "late"];

/** "What the group sees": a Telegram-style bubble for each kind of post. */
export function TelegramSamplePost({ botName }: { botName: string | null }) {
  const t = useT();
  const [sample, setSample] = useState<Sample>("request");
  const [detail, setDetail] = useState<TelegramDetail>("full");
  const post = SAMPLES[sample];

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("access.telegramPage.sample.title")}</CardTitle>
        <CardDescription>{t("access.telegramPage.sample.hint")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1 text-sm" role="radiogroup" aria-label={t("access.telegramPage.sample.title")}>
          {ORDER.map((key) => (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={sample === key}
              onClick={() => setSample(key)}
              className={cn(
                "truncate rounded-md px-2 py-1.5 font-medium transition-colors",
                sample === key ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t(`access.telegramPage.sample.tabs.${key}`)}
            </button>
          ))}
        </div>

        <TelegramDetailPicker value={detail} onChange={setDetail} />
        {/* The chat: a soft sky backdrop, one incoming bubble from the bot. */}
        <div className="rounded-xl bg-sky-500/5 p-3 ring-1 ring-sky-500/10 sm:p-4">
          <div className="w-full max-w-sm rounded-2xl rounded-bl-md border bg-card px-4 py-3 text-sm shadow-sm">
            <p className="mb-2 text-xs font-semibold text-sky-600 dark:text-sky-400">{botName ? `@${botName}` : t("access.telegramPage.sample.bot")}</p>

            <p className={cn("flex items-center gap-2 font-semibold tracking-wide", post.tone)}>
              <post.icon className="size-4 shrink-0" />
              {post.heading}
            </p>
            <Rule />
            <Lines lines={WHO[detail]} />
            <Rule />
            <Lines lines={post.details} />

            <p className="mt-2 text-right text-[11px] text-muted-foreground">10:24</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Rule() {
  return <div className="my-2 border-t" />;
}

function Lines({ lines }: { lines: Line[] }) {
  return (
    <ul className="flex flex-col gap-1">
      {lines.map((line) => (
        <li key={line.text} className={cn("flex items-start gap-2", line.indent && "pl-6 text-muted-foreground", line.strong && "font-medium")}>
          {line.icon && <line.icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />}
          <span className="min-w-0">{line.text}</span>
        </li>
      ))}
    </ul>
  );
}
