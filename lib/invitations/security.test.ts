import { describe, expect, it } from "vitest";
import { generateInvitationToken, hashInvitationToken } from "./security";

describe("generateInvitationToken", () => {
  it("produces a URL-safe token with sufficient entropy", () => {
    const token = generateInvitationToken();

    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    // 32 random bytes encoded as base64url => 43 characters.
    expect(token).toHaveLength(43);
  });

  it("produces a different token on every call", () => {
    const seen = new Set<string>();

    for (let index = 0; index < 50; index += 1) {
      seen.add(generateInvitationToken());
    }

    expect(seen).toHaveLength(50);
  });
});

describe("hashInvitationToken", () => {
  it("returns a stable sha-256 hex digest", () => {
    const token = generateInvitationToken();
    const digest = hashInvitationToken(token);

    expect(digest).toMatch(/^[0-9a-f]{64}$/);
    expect(hashInvitationToken(token)).toBe(digest);
  });

  it("never reveals the raw token", () => {
    const token = generateInvitationToken();
    const digest = hashInvitationToken(token);

    expect(digest).not.toContain(token);
  });

  it("produces different digests for different tokens", () => {
    expect(hashInvitationToken("token-a")).not.toBe(
      hashInvitationToken("token-b"),
    );
  });
});