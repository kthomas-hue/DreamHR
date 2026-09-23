import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "../api";
import { applyPalette } from "../theme/palettes";
import type { Me } from "../types";

interface AuthValue {
  me: Me | null;
  loading: boolean;
  refresh: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  switchClient: (clientId: string | null) => Promise<void>;
}

const AuthCtx = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await api.me();
      setMe(data);
      if (data.activeClient) applyPalette(data.activeClient.palette);
    } catch {
      setMe(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = useCallback(
    async (email: string, password: string) => {
      await api.login(email, password);
      await refresh();
    },
    [refresh],
  );

  const logout = useCallback(async () => {
    await api.logout();
    setMe(null);
  }, []);

  const switchClient = useCallback(
    async (clientId: string | null) => {
      const res = await api.switchClient(clientId);
      if (res.activeClient) applyPalette(res.activeClient.palette);
      await refresh();
    },
    [refresh],
  );

  return (
    <AuthCtx.Provider value={{ me, loading, refresh, login, logout, switchClient }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
