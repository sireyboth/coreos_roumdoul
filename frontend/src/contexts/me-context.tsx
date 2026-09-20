"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, clearToken, getToken, MeResponse } from "@/lib/api";

type MeContextValue = {
  me: MeResponse | null;
  loading: boolean;
  refresh: () => void;
  logout: () => void;
};

const MeContext = createContext<MeContextValue | null>(null);

export function MeProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);

  function load() {
    if (!getToken()) {
      router.push("/login");
      return;
    }

    setLoading(true);
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
    <MeContext.Provider value={{ me, loading, refresh: load, logout }}>
      {children}
    </MeContext.Provider>
  );
}

export function useMe() {
  const ctx = useContext(MeContext);
  if (!ctx) throw new Error("useMe must be used within a MeProvider");
  return ctx;
}
