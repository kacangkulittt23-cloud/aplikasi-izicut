import React, { createContext, useContext, useEffect, useState, useCallback } from "react";

import { api, TOKEN_KEY } from "@/src/api/client";
import { storage } from "@/src/utils/storage";

type AuthState = {
  ready: boolean;
  token: string | null;
  username: string | null;
  isAdmin: boolean;
  login: (u: string, p: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const t = await storage.secureGet<string>(TOKEN_KEY, "");
      const u = await storage.getItem<string>("eizicut_user", "");
      if (t) {
        setToken(t);
        setUsername(u || "admin");
      }
      setReady(true);
    })();
  }, []);

  const login = useCallback(async (u: string, p: string) => {
    const res = await api.login(u, p);
    await storage.secureSet(TOKEN_KEY, res.access_token);
    await storage.setItem("eizicut_user", res.username);
    setToken(res.access_token);
    setUsername(res.username);
  }, []);

  const logout = useCallback(async () => {
    await storage.secureRemove(TOKEN_KEY);
    await storage.removeItem("eizicut_user");
    setToken(null);
    setUsername(null);
  }, []);

  return (
    <AuthContext.Provider value={{ ready, token, username, isAdmin: !!token, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
