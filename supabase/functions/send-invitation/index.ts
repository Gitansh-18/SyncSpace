/* eslint-disable import/no-anonymous-default-export */

// Setup type definitions for built-in Supabase Runtime APIs
import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";

/* global Deno */
// This function sends invitation emails through Resend. It is called
// server-to-server by the Next.js app using a secret API key, so it rejects
// requests that only carry a publishable key.

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const RESEND_FROM =
  Deno.env.get("RESEND_FROM") ?? "Collab Editor <onboarding@resend.dev>";

const ROLE_LABELS = {
  EDITOR: "Editor",
  VIEWER: "Viewer",
} as const;

type InvitationPayload = {
  to: string;
  documentTitle: string;
  inviterName: string | null;
  inviteUrl: string;
  role: keyof typeof ROLE_LABELS;
};

function isInvitationPayload(value: unknown): value is InvitationPayload {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const payload = value as Partial<InvitationPayload>;

  return (
    typeof payload.to === "string" &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.to) &&
    typeof payload.documentTitle === "string" &&
    payload.documentTitle.length > 0 &&
    payload.documentTitle.length <= 200 &&
    typeof payload.inviteUrl === "string" &&
    payload.inviteUrl.startsWith("http") &&
    payload.inviteUrl.length <= 2000 &&
    typeof payload.role === "string" &&
    Object.prototype.hasOwnProperty.call(ROLE_LABELS, payload.role)
  );
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function buildEmailHtml(payload: InvitationPayload) {
  const roleLabel = ROLE_LABELS[payload.role];
  const inviterName = payload.inviterName || "A collaborator";

  return `
    <div style="background:#fafafa;padding:32px 16px;font-family:Arial,Helvetica,sans-serif;">
      <div style="max-width:480px;margin:0 auto;background:#ffffff;border:1px solid #e4e4e7;border-radius:12px;padding:32px;">
        <p style="margin:0;color:#18181b;font-size:15px;font-weight:600;">Collab Editor</p>
        <h1 style="margin:20px 0 8px;font-size:20px;line-height:1.4;color:#18181b;font-weight:600;">
          You're invited to edit "${escapeHtml(payload.documentTitle)}"
        </h1>
        <p style="margin:0 0 24px;color:#52525b;font-size:14px;line-height:1.6;">
          ${escapeHtml(inviterName)} invited you to collaborate on
          <strong>${escapeHtml(payload.documentTitle)}</strong> as a ${roleLabel}.
          Accept the invitation to open the document.
        </p>
        <a href="${escapeHtml(payload.inviteUrl)}" style="display:inline-block;background:#18181b;color:#ffffff;font-size:14px;font-weight:500;text-decoration:none;border-radius:8px;padding:10px 18px;">
          Accept invitation
        </a>
        <p style="margin:24px 0 0;color:#a1a1aa;font-size:12px;line-height:1.5;">
          This invitation link expires in 7 days. If you didn't expect this
          email, you can ignore it.
        </p>
      </div>
    </div>
  `;
}

export default {
  fetch: withSupabase({ auth: ["publishable", "secret"] }, async (req, ctx) => {
    // Only server-to-server calls with a secret key are allowed to send mail.
    if (ctx.authMode !== "secret") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    if (!RESEND_API_KEY) {
      return Response.json(
        { error: "Email provider is not configured" },
        { status: 500 },
      );
    }

    let payload: InvitationPayload;

    try {
      const body = await req.json();

      if (!isInvitationPayload(body)) {
        return Response.json(
          { error: "Invalid invitation payload" },
          { status: 400 },
        );
      }

      payload = body;
    } catch {
      return Response.json({ error: "Invalid JSON payload" }, { status: 400 });
    }

    let response: Response;

    try {
      response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: RESEND_FROM,
          to: [payload.to],
          subject: `You're invited to edit "${payload.documentTitle}" on Collab Editor`,
          html: buildEmailHtml(payload),
        }),
      });
    } catch (error) {
      console.error("send-invitation: Resend request failed", error);
      return Response.json(
        { error: `Invitation email could not be sent: ${error}` },
        { status: 502 },
      );
    }

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.error(
        "send-invitation: Resend request failed",
        response.status,
        detail,
      );
      return Response.json(
        {
          error: "Invitation email could not be sent",
          detail: `Resend returned ${response.status}: ${detail}`,
        },
        { status: 502 },
      );
    }

    return Response.json({ ok: true });
  }),
};
