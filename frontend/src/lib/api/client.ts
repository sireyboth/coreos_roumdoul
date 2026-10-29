// The HTTP client every API module uses: base URL, token, headers, retry, errors and the GET cache.

import { trackPageRead, withBusy } from "@/lib/busy";
import { createHttpCache } from "@/lib/http-cache";
import { currentLang } from "@/lib/i18n";
import type { MeResponse } from "./account";

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const TOKEN_KEY = "business_os_token";
const ME_SNAPSHOT_KEY = "business_os_me";

// Reference-data lists that many pages ask for again and again. Live data
// (attendance, schedules, the calendar) is deliberately not cached.
export const CACHEABLE_GET = /^\/api\/(branches|departments|teams|shifts|work_locations|holidays|employees|roles|permissions|users)(\?|$)/;
export const httpCache = createHttpCache(30_000);

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  window.localStorage.setItem(TOKEN_KEY, token);
  // A fresh sign-in starts clean, even if the previous session wasn't signed out properly.
  httpCache.clear();
}

export function clearToken() {
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(ME_SNAPSHOT_KEY);
  // Nothing from one person's session may be served to the next.
  httpCache.clear();
}

/**
 * The last /me answer, kept so the app can show itself straight away instead of
 * waiting a network round trip. It only ever decides what the UI shows — the
 * server still checks every request — and is refreshed right after. Tied to
 * the token so it can't outlive a sign-out or belong to another account.
 */
export function getMeSnapshot(token: string): MeResponse | null {
  try {
    const raw = window.localStorage.getItem(ME_SNAPSHOT_KEY);
    const saved = raw ? (JSON.parse(raw) as { token: string; me: MeResponse }) : null;
    return saved && saved.token === token ? saved.me : null;
  } catch {
    return null;
  }
}

export function saveMeSnapshot(token: string, me: MeResponse) {
  try {
    window.localStorage.setItem(ME_SNAPSHOT_KEY, JSON.stringify({ token, me }));
  } catch {
    // storage full or blocked — the snapshot is only an optimisation
  }
}

export class ApiError extends Error {
  status: number;
  errors?: Record<string, string[]>;
  /** Machine-readable reason, e.g. plan_limit_reached, trial_expired. */
  code?: string;

  constructor(status: number, message: string, errors?: Record<string, string[]>, code?: string) {
    super(message); 
    this.status = status;
    this.errors = errors;
    this.code = code;
  }
}

// The whole account is locked (not just this one request).
export const ACCOUNT_BLOCKED_CODES = ["trial_expired", "company_suspended", "company_cancelled", "company_deleted"];
export const ACCOUNT_BLOCKED_EVENT = "app:account-blocked";

/** Photo links from the API are relative and signed; this makes one loadable in an <img>. */
export function photoSrc(url?: string | null): string | null {
  return url ? `${API_URL}${url}` : null;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// background: work the user didn't ask for and isn't waiting on (marking a
// notification read, syncing push, the bell's unread count) — it must never
// freeze the screen. For a read, it means it never holds up a page opening.
type RequestOptions = RequestInit & { background?: boolean };

export async function request<T>(path: string, { background = false, ...options }: RequestOptions = {}): Promise<T> {
  const method = (options.method ?? "GET").toUpperCase();

  if (method === "GET") {
    const send = () => sendWithRetry<T>(path, options);
    const read = () => (CACHEABLE_GET.test(path) ? httpCache.get<T>(path, send) : send());
    return background ? read() : trackPageRead(read);
  }

  // Reads stay free (lists load and poll in the background); a write blocks
  // the app until it finishes, so it can't be double-submitted or interrupted.
  const send = async () => {
    try {
      return await sendOnce<T>(path, options);
    } finally {
      // Any change (even a failed one) may have altered what the lists show.
      httpCache.clear();
    }
  };
  return background ? send() : withBusy(send);
}

/** A dropped connection on a read is worth one more try; a write is never repeated automatically. */
async function sendWithRetry<T>(path: string, options: RequestInit): Promise<T> {
  try {
    return await sendOnce<T>(path, options);
  } catch (err) {
    if (!(err instanceof ApiError) || err.code !== "network_error") throw err;
    await sleep(800);
    return sendOnce<T>(path, options);
  }
}

async function sendOnce<T>(path: string, options: RequestInit): Promise<T> {
  const token = getToken();

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        // A FormData body sets its own multipart boundary — forcing JSON would break uploads.
        ...(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
        Accept: "application/json",
        // Server messages (errors, "Password updated.") come back in the language on screen.
        "Accept-Language": currentLang(),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });
  } catch (err) {
    // fetch() rejects with a plain TypeError for anything before a response comes back —
    // the server is down, the URL is wrong, or the network dropped. Left as-is, every
    // caller's catch block shows the generic "Something went wrong.", which is true but
    // useless here: this is the one case where we can name the actual problem.
    if (err instanceof TypeError) {
      throw new ApiError(
        0,
        `Can't reach the server at ${API_URL}. It may be offline, or check your internet connection.`,
        undefined,
        "network_error",
      );
    }
    throw err;
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    if (typeof window !== "undefined" && ACCOUNT_BLOCKED_CODES.includes(body.code)) {
      window.dispatchEvent(new CustomEvent(ACCOUNT_BLOCKED_EVENT, { detail: { code: body.code, message: body.message } }));
    }

    throw new ApiError(res.status, body.message ?? `Request failed (${res.status})`, body.errors, body.code);
  }

  if (res.status === 204) return undefined as T;

  return res.json();
}

/**
 * Every row of a paginated list, page by page — for exports, which must never
 * stop at the first 25. Asks for the largest page each endpoint allows.
 */
export async function requestAll<T>(path: string): Promise<T[]> {
  const join = path.includes("?") ? "&" : "?";
  const first = await request<Paginated<T>>(`${path}${join}page=1`);
  const rows = [...first.data];

  for (let page = 2; page <= (first.last_page ?? 1); page++) {
    rows.push(...(await request<Paginated<T>>(`${path}${join}page=${page}`)).data);
  }

  return rows;
}

export type Paginated<T> = { data: T[]; total: number; last_page?: number };
