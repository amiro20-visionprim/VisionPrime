import { ApiClient } from "@visionprime/api-client";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

const ACCESS_TOKEN_KEY = "vp_admin_access_token";

function getStoredAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(ACCESS_TOKEN_KEY);
}

/**
 * Single shared ApiClient instance for the Admin OS app. Token is read
 * lazily from localStorage on every request so a refreshed/cleared
 * token is always picked up without re-constructing the client — see
 * apps/admin/app/lib/auth-client.tsx for how the token is set.
 */
export const apiClient = new ApiClient({
  baseUrl: API_BASE_URL,
  getAuthHeader: () => {
    const token = getStoredAccessToken();
    return token ? { Authorization: `Bearer ${token}` } : ({} as Record<string, string>);
  },
});

export const AUTH_STORAGE_KEYS = {
  accessToken: ACCESS_TOKEN_KEY,
  refreshToken: "vp_admin_refresh_token",
} as const;
