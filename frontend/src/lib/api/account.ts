// Signing in, the signed-in user, notifications, push, profile and company settings.

import { request } from "./client";
import type { ProbationSettings } from "./organization";

export type MeResponse = {
  // email is null for someone who signs in with an employee ID; login_id is that ID.
  user: { id: number; name: string; email: string | null; login_id?: string | null; company_id: number | null; is_platform_admin: boolean };
  roles: string[];
  permissions: string[];
  // photo_url: a short-lived signed link — use photoSrc() to show it. nickname: they can change it on their profile.
  employee: { id: number; name: string; nickname: string | null; photo_url: string | null } | null;
  // allow_self_approval: people may approve or change their own attendance, leave balance and pay.
  // probation_*: the default probation for new people (e.g. 3 months) and how many days before it ends HR is reminded (null = on the day).
  company: {
    id: number;
    name: string;
    slug: string;
    status: string;
    trial_ends_at: string | null;
    allow_self_approval: boolean;
  } & ProbationSettings | null;
  // null limits mean unlimited.
  plan: { name: string; max_employees: number | null; max_branches: number | null } | null;
  usage: { employees: number; branches: number } | null;
  modules: Record<string, boolean>;
};

export type Notification = {
  id: number;
  // e.g. "attendance.correction_requested", "attendance.correction_decided", "welcome", "birthday".
  type: string;
  data: { title: string; body?: string; [key: string]: unknown };
  // Where clicking it goes (a dashboard path), if anywhere.
  link: string | null;
  // Who caused it (the requester, the reviewer).
  actor: string | null;
  read_at: string | null;
  // Someone already acted on what it's about: resolution is "approved" / "rejected", by resolved_by.
  resolved_at: string | null;
  resolution: string | null;
  resolved_by: string | null;
  created_at: string;
};

export const accountApi = {
  // Either an email, or a company code + employee ID — never both.
  login: (credentials: { email: string; password: string } | { company: string; employee_id: string; password: string }) =>
    request<{ token: string }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(credentials),
    }),
  register: (companyName: string, name: string, email: string, password: string) =>
    request<{ token: string }>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ company_name: companyName, name, email, password }),
    }),
  me: () => request<MeResponse>("/api/me", { background: true }),
  logout: () => request<{ message: string }>("/api/auth/logout", { method: "POST" }),
  // Background: an answer takes seconds, and the chat shows its own
  // "Thinking…" — it must not freeze the rest of the app meanwhile.
  askAssistant: (body: { question: string; history: { role: "user" | "assistant"; content: string }[] }) =>
    request<{ answer: string; status: "answered" | "off_topic" | "unknown" }>("/api/ai/assistant", {
      method: "POST",
      body: JSON.stringify(body),
      background: true,
    }),
  notifications: {
    list: () => request<Notification[]>("/api/notifications", { background: true }),
    // Cheap to poll: the unread count and the newest unread alert's id.
    unreadCount: () => request<{ count: number; latest_id: number | null }>("/api/notifications/unread-count", { background: true }),
    markAsRead: (id: number) =>
      request<void>(`/api/notifications/${id}/read`, { method: "POST", background: true }),
    markAllAsRead: () => request<void>("/api/notifications/read-all", { method: "POST", background: true }),
  },
  // Push notifications to this device, even with the app closed.
  push: {
    // enabled is false when the server has no push keys set up.
    key: () => request<{ enabled: boolean; public_key: string | null }>("/api/push/key", { background: true }),
    subscribe: (subscription: { endpoint: string; keys: { p256dh: string; auth: string }; content_encoding?: string }) =>
      request<void>("/api/push/subscriptions", { method: "POST", body: JSON.stringify(subscription), background: true }),
    unsubscribe: (endpoint: string) =>
      request<void>("/api/push/subscriptions", { method: "DELETE", body: JSON.stringify({ endpoint }), background: true }),
  },
  profile: {
    // current_password is needed only when the email changes. nickname: only for people with an employee record.
    update: (data: { name: string; email: string | null; current_password?: string; nickname?: string | null }) =>
      request<{ id: number; name: string; email: string | null }>("/api/profile", {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    updatePassword: (data: {
      current_password: string;
      password: string;
      password_confirmation: string;
    }) =>
      request<{ message: string }>("/api/profile/password", {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    // Your own photo (needs an employee record, no HR permission). Already cropped to a square.
    uploadPhoto: (photo: Blob) => {
      const body = new FormData();
      body.append("photo", photo, "photo.jpg");
      return request<{ photo_url: string | null }>("/api/profile/photo", { method: "POST", body });
    },
    removePhoto: () => request<void>("/api/profile/photo", { method: "DELETE" }),
  },
  companySettings: {
    update: (data: { allow_self_approval?: boolean }) =>
      request<{ id: number; allow_self_approval: boolean }>("/api/company/settings", {
        method: "PUT",
        body: JSON.stringify(data),
      }),
  },
};
