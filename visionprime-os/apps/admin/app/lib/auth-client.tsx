"use client";

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { ApiClientError } from "@visionprime/api-client";
import { apiClient, AUTH_STORAGE_KEYS } from "./api-client";

export interface AuthUser {
  id: string;
  email: string;
  full_name: string;
  is_active: boolean;
  is_super_admin: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

interface LoginResponse {
  user: AuthUser;
  permissions: string[];
  accessToken: string;
  refreshToken: string;
}

interface MeResponse {
  user: AuthUser;
  roleIds: string[];
  permissions: string[];
}

interface AuthContextValue {
  user: AuthUser | null;
  accessToken: string | null;
  permissions: string[];
  isSuperAdmin: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function readStorage(key: string): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(key);
}

function writeStorage(key: string, value: string | null) {
  if (typeof window === "undefined") return;
  if (value === null) {
    window.localStorage.removeItem(key);
  } else {
    window.localStorage.setItem(key, value);
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const hasTriedRefresh = useRef(false);

  const clearSession = useCallback(() => {
    setUser(null);
    setAccessToken(null);
    setPermissions([]);
    writeStorage(AUTH_STORAGE_KEYS.accessToken, null);
    writeStorage(AUTH_STORAGE_KEYS.refreshToken, null);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const result = await apiClient.post<LoginResponse>("/api/admin/auth/login", { email, password });
    writeStorage(AUTH_STORAGE_KEYS.accessToken, result.accessToken);
    writeStorage(AUTH_STORAGE_KEYS.refreshToken, result.refreshToken);
    setAccessToken(result.accessToken);
    setUser(result.user);
    setPermissions(result.permissions);
  }, []);

  const logout = useCallback(async () => {
    const refreshToken = readStorage(AUTH_STORAGE_KEYS.refreshToken);
    try {
      if (refreshToken) {
        await apiClient.post("/api/admin/auth/logout", { refreshToken });
      }
    } catch {
      // Best-effort: clear local session regardless of server outcome.
    } finally {
      clearSession();
    }
  }, [clearSession]);

  const trySilentRefresh = useCallback(async (): Promise<boolean> => {
    const refreshToken = readStorage(AUTH_STORAGE_KEYS.refreshToken);
    if (!refreshToken) return false;
    try {
      const result = await apiClient.post<LoginResponse>("/api/admin/auth/refresh", { refreshToken });
      writeStorage(AUTH_STORAGE_KEYS.accessToken, result.accessToken);
      writeStorage(AUTH_STORAGE_KEYS.refreshToken, result.refreshToken);
      setAccessToken(result.accessToken);
      setUser(result.user);
      setPermissions(result.permissions);
      return true;
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function resolveSession() {
      const storedAccessToken = readStorage(AUTH_STORAGE_KEYS.accessToken);
      if (!storedAccessToken) {
        if (isMounted) setIsLoading(false);
        return;
      }

      setAccessToken(storedAccessToken);

      try {
        const me = await apiClient.get<MeResponse>("/api/admin/auth/me");
        if (isMounted) {
          setUser(me.user);
          setPermissions(me.permissions);
        }
      } catch (error) {
        if (error instanceof ApiClientError && error.code === "AUTH_INVALID_TOKEN" && !hasTriedRefresh.current) {
          hasTriedRefresh.current = true;
          const refreshed = await trySilentRefresh();
          if (!refreshed) {
            clearSession();
          }
        } else {
          clearSession();
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    resolveSession();

    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value: AuthContextValue = {
    user,
    accessToken,
    permissions,
    isSuperAdmin: user?.is_super_admin ?? false,
    isLoading,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
