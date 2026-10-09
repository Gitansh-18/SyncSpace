import { DocumentRole } from "@prisma/client";

export class InvitationEmailError extends Error {}

type SendInvitationEmailInput = {
  to: string;
  documentTitle: string;
  inviterName: string | null;
  inviteUrl: string;
  role: DocumentRole;
};

export function buildInvitationUrl(token: string): string {
  const baseUrl = (process.env.AUTH_URL ?? "http://localhost:3000").replace(
    /\/+$/,
    "",
  );
  return `${baseUrl}/invitations/${token}`;
}

/**
 * Calls the existing `send-invitation` Supabase Edge Function with a
 * server-to-server secret API key. The API key never reaches the browser.
 */
export async function sendInvitationEmail(
  input: SendInvitationEmailInput,
): Promise<void> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !supabaseSecretKey) {
    throw new InvitationEmailError(
      "Invitation email is not configured on the server",
    );
  }

  const endpoint = `${supabaseUrl.replace(/\/+$/, "")}/functions/v1/send-invitation`;

  let response: Response;

  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: supabaseSecretKey,
      },
      body: JSON.stringify(input),
    });
  } catch {
    throw new InvitationEmailError("Invitation email request failed");
  }

  if (!response.ok) {
    throw new InvitationEmailError(
      `Invitation email request failed (${response.status})`,
    );
  }
}