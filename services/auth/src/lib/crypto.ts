import { createHash, randomBytes } from "node:crypto";

export function generateRefreshToken(): string {
  return randomBytes(32).toString("hex"); // Generate a random 32-byte token and convert it to a hexadecimal string
}

/**
 * Fast SHA-256 hash for refresh tokens.
 * We use SHA-256 (not argon2) because these are high-entropy random values,
 * not user-chosen passwords. No need for slow hashing.
 */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex"); // Hash the token using SHA-256
}

/**
 * Why this slow or fast hashing?
 * - For passwords, we use argon2, which is designed to be slow and resistant to brute-force attacks.
 * - For refresh tokens, we use SHA-256, which is fast and sufficient for hashing high-entropy random values.
 */
