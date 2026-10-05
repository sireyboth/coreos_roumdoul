"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ACCOUNT_BLOCKED_EVENT, ApiError, api, clearToken, getMeSnapshot, getToken, MeResponse, saveMeSnapshot } from "@/lib/api";
import { disablePush } from "@/lib/push";

type BlockedInfo = { code: string; message: string };

type MeContextValue = {
  me: MeResponse | null;
  loading: boolean;
  /** Set when the API says the whole account is locked (trial over, suspended…). */
  blocked: BlockedInfo | null;
  refresh: () => void;
  logout: () => void;
};

const MeContext = createContext<MeContextValue | null>(null);

export function MeProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [blocked, setBlocked] = useState<BlockedInfo | null>(null);

  function load() {
    const token = getToken();

    if (!token) {
      router.push("/login");
      return;
    }

    // Only show the full-screen loader the first time — a later refresh
    // (e.g. updating usage after adding an employee) must not blank the page.
    if (!me) {
      // If we know who this is from last time, show the app straight away and
      // let the fresh answer below correct anything that changed.
      const known = getMeSnapshot(token);
      if (known) {
        setMe(known);
        setLoading(false);
      } else {
        setLoading(true);
      }
    }

    verify(token, 0);
  }

  // Signs out only when the server says the token is no good (401). Anything
  // else — no signal yet right after reopening the app, the server waking up,
  // a hiccup — keeps the person signed in and tries again shortly; otherwise
  // closing the app on a phone and reopening it would sign them out.
  function verify(token: string, attempt: number) {
    api
      .me()
      .then((fresh) => {
        saveMeSnapshot(token, fresh);
        setMe(fresh);
        setLoading(false);
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          clearToken();
          router.push("/login");
          setLoading(false);
          return;
        }
        // Signed out elsewhere meanwhile (e.g. another tab): stop retrying.
        if (getToken() !== token) return;
        setTimeout(() => verify(token, attempt + 1), Math.min(2000 * 2 ** attempt, 30_000));
      });
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onBlocked = (event: Event) => setBlocked((event as CustomEvent<BlockedInfo>).detail);
    window.addEventListener(ACCOUNT_BLOCKED_EVENT, onBlocked);
    return () => window.removeEventListener(ACCOUNT_BLOCKED_EVENT, onBlocked);
  }, []);

  async function logout() {
    // Before the token goes: a shared phone must stop getting this person's alerts.
    await disablePush().catch(() => {});
    try {
      await api.logout();
    } catch {
      // token may already be invalid — clear locally regardless
    }
    clearToken();
    router.push("/login");
  }

  return (
    <MeContext.Provider value={{ me, loading, blocked, refresh: load, logout }}>
      {children}
    </MeContext.Provider>
  );
}

export function useMe() {
  const ctx = useContext(MeContext);
  if (!ctx) throw new Error("useMe must be used within a MeProvider");
  return ctx;
}
