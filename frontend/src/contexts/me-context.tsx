"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ACCOUNT_BLOCKED_EVENT, api, clearToken, getToken, MeResponse } from "@/lib/api";

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
    if (!getToken()) {
      router.push("/login");
      return;
    }

    // Only show the full-screen loader the first time — a later refresh
    // (e.g. updating usage after adding an employee) must not blank the page.
    if (!me) setLoading(true);
    api
      .me()
      .then(setMe)
      .catch(() => {
        clearToken();
        router.push("/login");
      })
      .finally(() => setLoading(false));
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
