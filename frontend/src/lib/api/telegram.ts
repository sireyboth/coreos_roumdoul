// Telegram group alerts: the company's linked groups and what each gets.
// Company admins only (company.manage).

import { request } from "./client";

/** What a group can get. Pay and private reasons are never posted. */
export type TelegramEvent = "requests" | "request_decisions" | "late_warnings";

/** How much of the employee a post shows: full = name, Khmer name, ID, job, department, branch; basic = name and branch. */
export type TelegramDetail = "full" | "basic";

export type TelegramGroup = {
  id: number;
  title: string | null;
  /** null = posts about every branch; otherwise only these branches. */
  branch_ids: number[] | null;
  events: TelegramEvent[];
  detail: TelegramDetail;
  created_at: string;
  updated_at: string;
};

export type TelegramStatus = {
  /** false = the server has no bot set up yet; the page explains instead of offering Connect. */
  available: boolean;
  bot_username: string | null;
  events: TelegramEvent[];
  details: TelegramDetail[];
  max_groups: number;
  groups: TelegramGroup[];
};

/** Open `link` in Telegram and pick the group; it's valid until expires_at and works once. */
export type TelegramLink = { link: string; code: string; expires_at: string };

export type TelegramGroupChanges = Partial<Pick<TelegramGroup, "events" | "detail" | "branch_ids">>;

export const telegramApi = {
  telegram: {
    status: () => request<TelegramStatus>("/api/telegram"),
    /** branch_ids: null = the new group covers every branch. */
    link: (branchIds: number[] | null) =>
      request<TelegramLink>("/api/telegram/link", { method: "POST", body: JSON.stringify(branchIds === null ? {} : { branch_ids: branchIds }) }),
    update: (id: number, changes: TelegramGroupChanges) =>
      request<TelegramGroup>(`/api/telegram/groups/${id}`, { method: "PUT", body: JSON.stringify(changes) }),
    test: (id: number) => request<void>(`/api/telegram/groups/${id}/test`, { method: "POST", body: "{}" }),
    disconnect: (id: number) => request<void>(`/api/telegram/groups/${id}`, { method: "DELETE" }),
  },
};
