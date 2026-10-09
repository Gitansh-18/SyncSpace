import { describe, expect, it } from "vitest";
import { getSafeCallbackUrl } from "./callback-url";

describe("getSafeCallbackUrl", () => {
  it("accepts same-origin relative paths", () => {
    expect(getSafeCallbackUrl("/dashboard")).toBe("/dashboard");
    expect(getSafeCallbackUrl("/invitations/abc123")).toBe(
      "/invitations/abc123",
    );
  });

  it("preserves query strings on safe relative URLs", () => {
    expect(getSafeCallbackUrl("/documents/abc?tab=members")).toBe(
      "/documents/abc?tab=members",
    );
  });

  it("rejects non-string values", () => {
    expect(getSafeCallbackUrl(null)).toBeNull();
    expect(getSafeCallbackUrl(undefined)).toBeNull();
    expect(getSafeCallbackUrl(42)).toBeNull();
  });

  it("rejects the bare root path", () => {
    expect(getSafeCallbackUrl("/")).toBeNull();
  });

  it("rejects protocol-relative URLs", () => {
    expect(getSafeCallbackUrl("//evil.example.com")).toBeNull();
    expect(getSafeCallbackUrl("/\\evil.example.com")).toBeNull();
  });

  it("rejects absolute URLs", () => {
    expect(getSafeCallbackUrl("https://evil.example.com")).toBeNull();
    expect(getSafeCallbackUrl("http://evil.example.com")).toBeNull();
    expect(getSafeCallbackUrl("javascript:alert(1)")).toBeNull();
  });
});