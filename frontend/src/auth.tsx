import React, { createContext, useContext, useEffect, useState, useCallback } from "react";

import { apiFetch, getToken, setToken } from "@/src/api";
import { queryClient } from "@/src/query-client";

export type User = {
  id: string;
  email: string;
  is_admin: boolean;
  profile: any;
  settings: any;
  equipment: string[];
  gamification: any;
  created_at: string;
};

type AuthCtx = {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  setUser: (u: User) => void;
};

const Ctx = createContext<AuthCtx>(null!);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);
  const [token, setTokenState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const t = await getToken();
        if (t) {
          setTokenState(t);
          const me = await apiFetch<User>("/auth/me");
          setUserState(me);
        }
      } catch {
        await setToken(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await apiFetch<{ access_token: string; user: User }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    await setToken(res.access_token);
    setTokenState(res.access_token);
    setUserState(res.user);
  }, []);

  const register = useCallback(async (email: string, password: string, name: string) => {
    const res = await apiFetch<{ access_token: string; user: User }>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password, name }),
    });
    await setToken(res.access_token);
    setTokenState(res.access_token);
    setUserState(res.user);
  }, []);

  const logout = useCallback(async () => {
    await setToken(null);
    setTokenState(null);
    setUserState(null);
    queryClient.clear();
  }, []);

  const refreshUser = useCallback(async () => {
    const me = await apiFetch<User>("/auth/me");
    setUserState(me);
  }, []);

  return (
    <Ctx.Provider value={{ user, token, loading, login, register, logout, refreshUser, setUser: setUserState }}>
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
