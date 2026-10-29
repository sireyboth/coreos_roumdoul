// Who is signed in. Wraps the whole app (src/app/_layout.tsx); screens read it with useSession().
//
// On start: read the saved token → ask /me → signed in, or back to sign-in if the token is dead.
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { api, ApiError, type Credentials, type MeResponse } from '@/lib/api';
import { setAuthToken, setUnauthorizedHandler } from '@/lib/api/client';
import { getItem, setItem } from '@/lib/storage';

const TOKEN_KEY = 'business_os_token';

type Session = {
  /** null while loading or when signed out. */
  me: MeResponse | null;
  isLoading: boolean;
  signIn: (credentials: Credentials) => Promise<void>;
  signOut: () => Promise<void>;
};

const SessionContext = createContext<Session | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [isLoading, setLoading] = useState(true);

  const forget = useCallback(async () => {
    setAuthToken(null);
    setMe(null);
    await setItem(TOKEN_KEY, null);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => void forget());
    (async () => {
      const saved = await getItem(TOKEN_KEY);
      if (saved) {
        setAuthToken(saved);
        try {
          setMe(await api.me());
        } catch (err) {
          // A dead token signs out; a network error keeps the token for next time.
          if (err instanceof ApiError && err.status === 401) await forget();
        }
      }
      setLoading(false);
    })();
    return () => setUnauthorizedHandler(null);
  }, [forget]);

  const signIn = useCallback(async (credentials: Credentials) => {
    const { token } = await api.login(credentials);
    setAuthToken(token);
    await setItem(TOKEN_KEY, token);
    setMe(await api.me());
  }, []);

  const signOut = useCallback(async () => {
    try {
      await api.logout();
    } catch {
      // Signing out locally still works when the server can't be reached.
    }
    await forget();
  }, [forget]);

  const value = useMemo(() => ({ me, isLoading, signIn, signOut }), [me, isLoading, signIn, signOut]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): Session {
  const session = useContext(SessionContext);
  if (!session) throw new Error('useSession must be used inside <SessionProvider>');
  return session;
}
