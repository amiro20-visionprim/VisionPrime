import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "crypto";

/**
 * AES-256-GCM at-rest encryption for integration secrets (WooCommerce
 * consumer key/secret, shared webhook secret). The key is derived from
 * `INTEGRATION_ENCRYPTION_KEY` (never hardcoded, see env-schema.ts).
 * Format: `<iv-hex>:<authtag-hex>:<ciphertext-hex>`.
 */
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;

function deriveKey(encryptionKey: string): Buffer {
  return createHash("sha256").update(encryptionKey).digest();
}

export function encryptSecret(plaintext: string, encryptionKey: string): string {
  const key = deriveKey(encryptionKey);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${ciphertext.toString("hex")}`;
}

export function decryptSecret(encrypted: string, encryptionKey: string): string {
  const key = deriveKey(encryptionKey);
  const [ivHex, authTagHex, ciphertextHex] = encrypted.split(":");
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(authTagHex, "hex"));
  const plaintext = Buffer.concat([decipher.update(Buffer.from(ciphertextHex, "hex")), decipher.final()]);
  return plaintext.toString("utf8");
}

/**
 * Plugin API keys are only ever verified, never displayed back — hashed
 * one-way with the same scrypt format as admin passwords (see
 * common/auth/password.ts), kept separate since the call sites differ.
 */
export { hashPassword as hashPluginApiKey, verifyPassword as verifyPluginApiKey } from "./auth/password";

/**
 * Verifies a WooCommerce-style webhook signature: base64(HMAC-SHA256(raw
 * request body, shared secret)), compared against the
 * `X-WC-Webhook-Signature` header value using a timing-safe comparison.
 * Must be called against the *raw* (un-parsed) body — a re-serialized
 * JSON body will not byte-for-byte match what was signed.
 */
export function verifyWebhookSignature(rawBody: Buffer | string, signatureHeader: string | undefined, secret: string): boolean {
  if (!signatureHeader) {
    return false;
  }
  const expected = createHmac("sha256", secret).update(rawBody).digest("base64");
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(signatureHeader);
  if (expectedBuffer.length !== actualBuffer.length) {
    return false;
  }
  return timingSafeEqual(expectedBuffer, actualBuffer);
}

export function maskSecretPreview(plaintext: string): string {
  if (plaintext.length <= 4) {
    return "****";
  }
  return `****${plaintext.slice(-4)}`;
}
