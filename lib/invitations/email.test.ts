import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildInvitationUrl,
  InvitationEmailError,
  sendInvitationEmail,
} from "./email";

const originalAuthUrl = process.env.AUTH_URL;
const originalSupabaseUrl = process.env.SUPABASE_URL;
const originalSupabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

afterEach(() => {
  vi.unstubAllGlobals();
  process.env.AUTH_URL = originalAuthUrl;
  process.env.SUPABASE_URL = originalSupabaseUrl;
  process.env.SUPABASE_SECRET_KEY = originalSupabaseSecretKey;
});

describe("buildInvitationUrl", () => {
  it("builds an absolute URL from AUTH_URL", () => {
    process.env.AUTH_URL = "https://collab.example.com";

    expect(buildInvitationUrl("token-123")).toBe(
      "https://collab.example.com/invitations/token-123",
    );
  });

  it("strips a trailing slash from AUTH_URL", () => {
    process.env.AUTH_URL = "https://collab.example.com/";

    expect(buildInvitationUrl("token-123")).toBe(
      "https://collab.example.com/invitations/token-123",
    );
  });

  it("falls back to localhost when AUTH_URL is missing", () => {
    delete process.env.AUTH_URL;

    expect(buildInvitationUrl("token-123")).toBe(
      "http://localhost:3000/invitations/token-123",
    );
  });
});

describe("sendInvitationEmail", () => {
  beforeEach(() => {
    process.env.SUPABASE_URL = "https://project.supabase.co";
    process.env.SUPABASE_SECRET_KEY = "sb_secret_test";
  });

  it("posts the payload to the send-invitation Edge Function", async () => {
    const fetchMock = vi.fn(
      async (_url: string | URL | Request, init?: RequestInit) => {
        expect(init?.method).toBe("POST");
        expect(init?.headers).toMatchObject({ apikey: "sb_secret_test" });
        return new Response(null, { status: 200 });
      },
    );
    vi.stubGlobal("fetch", fetchMock);

    await sendInvitationEmail({
      to: "alice@example.com",
      documentTitle: "Design doc",
      inviterName: "Bob",
      inviteUrl: "https://collab.example.com/invitations/token-123",
      role: "EDITOR",
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe(
      "https://project.supabase.co/functions/v1/send-invitation",
    );
  });

  it("throws when Supabase credentials are not configured", async () => {
    delete process.env.SUPABASE_URL;

    await expect(
      sendInvitationEmail({
        to: "alice@example.com",
        documentTitle: "Design doc",
        inviterName: null,
        inviteUrl: "https://collab.example.com/invitations/token-123",
        role: "VIEWER",
      }),
    ).rejects.toBeInstanceOf(InvitationEmailError);
  });

  it("rethrows transport failures as InvitationEmailError", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network down");
      }),
    );

    await expect(
      sendInvitationEmail({
        to: "alice@example.com",
        documentTitle: "Design doc",
        inviterName: null,
        inviteUrl: "https://collab.example.com/invitations/token-123",
        role: "VIEWER",
      }),
    ).rejects.toBeInstanceOf(InvitationEmailError);
  });

  it("throws when the Edge Function returns a non-2xx status", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 502 })),
    );

    await expect(
      sendInvitationEmail({
        to: "alice@example.com",
        documentTitle: "Design doc",
        inviterName: null,
        inviteUrl: "https://collab.example.com/invitations/token-123",
        role: "VIEWER",
      }),
    ).rejects.toBeInstanceOf(InvitationEmailError);
  });
});