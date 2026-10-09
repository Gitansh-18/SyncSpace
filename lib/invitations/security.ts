import { createHash, randomBytes } from "crypto";

/**
 * Generates a cryptographically random, URL-safe invitation token.
 * 256 bits of entropy make the token unpredictable for brute force.
 */
export function generateInvitationToken(): string {
  return randomBytes(32).toString("base64url");
}

/**
 * Stores only the SHA-256 digest of the token. The raw token is sent in the
 * invitation email link and is never persisted, so a database leak does not
 * expose usable invitation links.
 */
export function hashInvitationToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}