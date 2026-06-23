import { randomBytes, scryptSync, timingSafeEqual } from "crypto";

/**
 * Password hashing using Node's built-in scrypt (no bcrypt dependency).
 * Format: `scrypt:<salt-hex>:<hash-hex>` — matches the format already
 * produced by `packages/database/src/run-seed.ts`, so hashes created
 * here and there are interchangeable.
 */
const SCRYPT_KEYLEN = 64;

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, SCRYPT_KEYLEN).toString("hex");
  return `scrypt:${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(":");
  if (parts.length !== 3 || parts[0] !== "scrypt") {
    return false;
  }

  const [, salt, hashHex] = parts;
  const expected = Buffer.from(hashHex, "hex");
  const actual = scryptSync(password, salt, SCRYPT_KEYLEN);

  if (expected.length !== actual.length) {
    return false;
  }

  return timingSafeEqual(expected, actual);
}
