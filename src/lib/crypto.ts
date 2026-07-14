/**
 * Token Cryptography Module
 * -------------------------
 * AES-256-GCM symmetric encryption wrapper for storing sensitive
 * integration credentials (GitHub PATs, GHL tokens, Callfluent keys)
 * safely at rest in the Postgres `integrations` table.
 *
 * Uses Node.js native `crypto` module — no external dependencies.
 * Format of ciphertext: base64(iv):base64(authTag):base64(ciphertext)
 */

import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  createHash,
} from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // GCM recommended IV length
const KEY_LENGTH = 32; // 256 bits

const FALLBACK_SECRET =
  "leadflow-pro-fallback-secret-do-not-use-in-production-please";

/**
 * Derive a stable 32-byte encryption key from the ENCRYPTION_SECRET
 * env var (or a hardcoded local fallback) using SHA-256.
 */
function getKey(): Buffer {
  const secret = process.env.ENCRYPTION_SECRET || FALLBACK_SECRET;
  return createHash("sha256").update(secret).digest().subarray(0, KEY_LENGTH);
}

/**
 * Encrypt a plaintext string. Returns null-safe: empty/undefined input
 * yields an empty string so callers can safely store it.
 */
export function encryptToken(text: string): string {
  if (!text) return "";

  try {
    const key = getKey();
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, key, iv);
    const encrypted = Buffer.concat([
      cipher.update(text, "utf8"),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();

    const payload = [
      iv.toString("base64"),
      authTag.toString("base64"),
      encrypted.toString("base64"),
    ].join(":");

    return payload;
  } catch (err) {
    console.error("[crypto] encryptToken failed:", err);
    throw new Error("Failed to encrypt token");
  }
}

/**
 * Decrypt a ciphertext produced by `encryptToken`.
 * If the input is empty, returns "" (never throws for empty input).
 * If the input is not a valid ciphertext (e.g. legacy plaintext),
 * returns the original string untouched — this lets us migrate gradually.
 */
export function decryptToken(ciphertext: string): string {
  if (!ciphertext) return "";

  // Detect legacy plaintext (no colon-separated triple). Return as-is.
  const parts = ciphertext.split(":");
  if (parts.length !== 3) {
    return ciphertext;
  }

  try {
    const key = getKey();
    const iv = Buffer.from(parts[0], "base64");
    const authTag = Buffer.from(parts[1], "base64");
    const encrypted = Buffer.from(parts[2], "base64");

    if (iv.length !== IV_LENGTH) {
      // Not a valid GCM payload — probably legacy plaintext with colons.
      return ciphertext;
    }

    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);

    return decrypted.toString("utf8");
  } catch (err) {
    console.error("[crypto] decryptToken failed:", err);
    throw new Error("Failed to decrypt token");
  }
}

/**
 * Utility: check if a value appears to already be encrypted with our scheme.
 * Useful when double-encryption must be avoided.
 */
export function isEncrypted(value: string | null | undefined): boolean {
  if (!value) return false;
  const parts = value.split(":");
  if (parts.length !== 3) return false;
  try {
    const iv = Buffer.from(parts[0], "base64");
    return iv.length === IV_LENGTH;
  } catch {
    return false;
  }
}
