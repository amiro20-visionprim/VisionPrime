import jwt from "jsonwebtoken";
import { randomBytes, createHash } from "crypto";

export interface AccessTokenPayload {
  userId: string;
  permissions: string[];
  isSuperAdmin: boolean;
}

/**
 * Signs a short-lived access token. `ttlMinutes` comes from config
 * (`JWT_ACCESS_TTL_MINUTES`) — never hardcoded here.
 */
export function signAccessToken(payload: AccessTokenPayload, secret: string, ttlMinutes: number): string {
  return jwt.sign(payload, secret, { expiresIn: `${ttlMinutes}m` });
}

export function verifyAccessToken(token: string, secret: string): AccessTokenPayload {
  const decoded = jwt.verify(token, secret);
  if (typeof decoded === "string") {
    throw new Error("Invalid token payload");
  }
  return {
    userId: decoded.userId,
    permissions: decoded.permissions,
    isSuperAdmin: decoded.isSuperAdmin,
  };
}

/**
 * Refresh tokens are opaque random strings handed to the client; only
 * their SHA-256 hash is persisted (in `sessions.refresh_token_hash`) so a
 * stolen DB dump never yields usable tokens.
 */
export function generateRefreshToken(): string {
  return randomBytes(32).toString("hex");
}

export function hashRefreshToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
