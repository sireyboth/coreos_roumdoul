// Signing in, the signed-in user, signing out.

import { request } from './client';

/** Email for admins; company code + employee ID for staff (same as the web sign-in). */
export type Credentials =
  | { email: string; password: string }
  | { company: string; employee_id: string; password: string };

export type LoginResponse = {
  token: string;
  user: { id: number; name: string; email: string | null; company_id: number | null };
};

/** The parts of /me the app uses so far; the web app's MeResponse has the full shape. */
export type MeResponse = {
  user: { id: number; name: string; email: string | null; login_id?: string | null; company_id: number | null };
  roles: string[];
  permissions: string[];
  employee: { id: number; name: string } | null;
  company: { id: number; name: string; slug: string; status: string; trial_ends_at: string | null } | null;
};

export const accountApi = {
  login: (credentials: Credentials) =>
    request<LoginResponse>('/auth/login', { method: 'POST', body: JSON.stringify(credentials) }),
  me: () => request<MeResponse>('/me'),
  logout: () => request<{ message: string }>('/auth/logout', { method: 'POST' }),
};
