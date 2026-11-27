"use client";

import { useState } from "react";
import { Plus, Send, ShieldCheck } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TelegramConnectDialog } from "@/components/dashboard/access/telegram-connect-dialog";
import { EVENT_LOOK, TelegramGroupDialog } from "@/components/dashboard/access/telegram-group-dialog";
import { reachLabel, type BranchOption } from "@/components/dashboard/access/telegram-group-fields";
import { TelegramSamplePost } from "@/components/dashboard/access/telegram-sample-post";
import { PageHeader } from "@/components/dashboard/layout/page-header";
import { useApi } from "@/hooks/use-api";
import { api, type TelegramGroup, type TelegramStatus } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * The company's Telegram groups (company.manage). One bot serves every
 * company; each company links as many groups as it needs — e.g. management
 * for every branch, and an HR group per branch — and chooses, per group,
 * which branches it covers, how much it shows and which posts it gets.
 * Connecting happens in Telegram (TelegramConnectDialog); managing in
 * TelegramGroupDialog.
 */
export default function TelegramPage() {
  const t = useT();
  const { data, error, reload } = useApi(() => api.telegram.status(), []);
  const { data: branchList } = useApi(() => api.branches.all(), []);
  const [connecting, setConnecting] = useState(false);
  const [managing, setManaging] = useState<TelegramGroup | null>(null);

  const branches: BranchOption[] = (branchList ?? []).map((b) => ({ id: b.id, name: b.name }));

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <PageHeader title={t("access.telegramPage.title")} description={t("access.telegramPage.description")} />

        {error && <Alert variant="destructive">{error}</Alert>}
        {!data && !error && <Skeleton className="h-56 w-full rounded-xl" />}

        {data && !data.available && (
          <Alert variant="warning" title={t("access.telegramPage.unavailableTitle")}>
            {t("access.telegramPage.unavailableBody")}
          </Alert>
        )}

        {data?.available && (
          <>
            <GroupsCard status={data} branches={branches} onConnect={() => setConnecting(true)} onManage={setManaging} />
            <TelegramSamplePost botName={data.bot_username} />

            {/* Each dialog mounts fresh when opened, so it starts from the current data. */}
            {connecting && <TelegramConnectDialog open onOpenChange={setConnecting} branches={branches} groups={data.groups} onConnected={reload} />}
            {managing && (
              <TelegramGroupDialog
                key={managing.id}
                group={managing}
                events={data.events}
                botName={data.bot_username}
                branches={branches}
                onOpenChange={(open) => !open && setManaging(null)}
                onChanged={reload}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}

/** The linked groups, one row each, with Connect and the safety advice. */
function GroupsCard({
  status,
  branches,
  onConnect,
  onManage,
}: {
  status: TelegramStatus;
  branches: BranchOption[];
  onConnect: () => void;
  onManage: (group: TelegramGroup) => void;
}) {
  const t = useT();
  const full = status.groups.length >= status.max_groups;

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <BotTile />
          <div>
            <CardTitle>{t("access.telegramPage.groupsTitle")}</CardTitle>
            <CardDescription>{t("access.telegramPage.groupsHint")}</CardDescription>
          </div>
        </div>
        <Button onClick={onConnect} disabled={full}>
          <Plus className="size-4" />
          {t("access.telegramPage.connectGroup")}
        </Button>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        {full && <p className="text-xs text-muted-foreground">{t("access.telegramPage.maxReached", { n: status.max_groups })}</p>}

        {status.groups.length === 0 ? (
          <div className="flex flex-col items-center gap-1 rounded-lg border border-dashed px-4 py-8 text-center">
            <p className="text-sm font-medium">{t("access.telegramPage.empty")}</p>
            <p className="max-w-sm text-xs text-muted-foreground">{t("access.telegramPage.emptyHint")}</p>
          </div>
        ) : (
          <ul className="divide-y rounded-lg border">
            {status.groups.map((group) => (
              <li key={group.id} className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:p-4">
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-sky-500/10 text-sky-600 ring-1 ring-sky-500/20 dark:text-sky-400">
                    <Send className="size-4" />
                  </span>
                  <div className="flex min-w-0 flex-col gap-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-semibold">{group.title || t("access.telegramPage.untitled")}</p>
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-2 py-0.5 text-[11px] font-medium text-success ring-1 ring-success/20">
                        <span className="size-1.5 rounded-full bg-success" />
                        {t("access.telegramPage.connected")}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 text-xs">
                      <Chip>{reachLabel(t, group.branch_ids, branches)}</Chip>
                      <Chip>{t(`access.telegramPage.detail.${group.detail}.label`)}</Chip>
                      <PostIcons group={group} />
                    </div>
                  </div>
                </div>
                <Button variant="outline" size="sm" className="self-start sm:self-center" onClick={() => onManage(group)}>
                  {t("access.telegramPage.manage")}
                </Button>
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-col gap-1.5 rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
          <p className="flex items-center gap-2 font-medium text-foreground">
            <ShieldCheck className="size-4 shrink-0 text-success" />
            {t("access.telegramPage.adviceTitle")}
          </p>
          <ul className="flex list-disc flex-col gap-1 pl-10">
            <li>{t("access.telegramPage.advice1")}</li>
            <li>{t("access.telegramPage.advice2")}</li>
            <li>{t("access.telegramPage.advice3")}</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}

/** Which posts a group gets, as small icons — or "No posts". */
function PostIcons({ group }: { group: TelegramGroup }) {
  const t = useT();

  if (group.events.length === 0) return <Chip muted>{t("access.telegramPage.noPosts")}</Chip>;

  return (
    <span
      className="inline-flex items-center gap-1"
      title={group.events.map((e) => t(`access.telegramPage.events.${e}.label`)).join(", ")}
      aria-label={group.events.length === 1 ? t("access.telegramPage.onePostType") : t("access.telegramPage.postTypes", { n: group.events.length })}
    >
      {group.events.map((event) => {
        const look = EVENT_LOOK[event];
        return (
          <span key={event} className={cn("flex size-6 items-center justify-center rounded-md ring-1", look.tile)}>
            <look.icon className="size-3.5" />
          </span>
        );
      })}
    </span>
  );
}

function Chip({ children, muted = false }: { children: React.ReactNode; muted?: boolean }) {
  return (
    <span className={cn("rounded-md border px-2 py-0.5 font-medium", muted ? "text-muted-foreground" : "text-foreground/80")}>{children}</span>
  );
}

/** The one solid accent on the page: Telegram's blue paper plane. */
function BotTile() {
  return (
    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-sky-500 to-blue-500 text-white shadow-sm">
      <Send className="size-5" />
    </span>
  );
}
