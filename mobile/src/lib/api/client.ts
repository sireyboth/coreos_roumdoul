// The HTTP client every API module uses: base URL, token, headers and errors.
// Same contract as the web app's frontend/src/lib/api/client.ts, but on /api/v1.

/** Set in mobile/.env — see .env.example. On a real phone this is your Mac's Wi-Fi IP, never localhost. */
export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000').replace(/\/+$/, '');
const API_BASE = `${API_URL}/api/v1`;

let token: string | null = null;
let language: 'en' | 'km' = 'en';

/** The session sets this after sign-in / on start; every request then sends it. */
export function setAuthToken(value: string | null) {
  token = value;
}

/** Server messages (errors, "Password updated.") come back in this language. */
export function setLanguage(value: 'en' | 'km') {
  language = value;
}

/**
 * Every API error has the same shape: { message, code, request_id } (+ errors on 422).
 * Show `message`; branch on `code`; quote `requestId` when reporting a problem —
 * it finds the exact request in the server logs.
 */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public errors?: Record<string, string[]>,
    public code?: string,
    public requestId?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** Called when the server says the token is no longer valid (expired, signed out elsewhere). */
let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(handler: (() => void) | null) {
  onUnauthorized = handler;
}

export async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
        Accept: 'application/json',
        'Accept-Language': language,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });
  } catch {
    // No response at all: server down, wrong address, or no network. On a phone the
    // usual cause is EXPO_PUBLIC_API_URL still pointing at localhost (= the phone itself).
    throw new ApiError(0, `Can't reach the server at ${API_URL}. Check your internet connection.`, undefined, 'network_error');
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    if (res.status === 401 && token) onUnauthorized?.();
    throw new ApiError(
      res.status,
      body.message ?? `Request failed (${res.status})`,
      body.errors,
      body.code,
      body.request_id ?? res.headers.get('X-Request-Id') ?? undefined,
    );
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}
