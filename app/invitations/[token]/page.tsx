import Link from "next/link";
import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import { db } from "@/lib/db";
import { formatRole } from "@/lib/documents/permissions";
import { getInvitationByToken } from "@/lib/invitations/queries";
import { AcceptInvitationForm } from "./accept-invitation-form";

type InvitationPageProps = {
  params: Promise<{ token: string }>;
};

export default async function InvitationPage({
  params,
}: InvitationPageProps) {
  const { token } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=${encodeURIComponent(`/invitations/${token}`)}`);
  }

  const user = session.user;
  const invitation = await getInvitationByToken(token);

  const alreadyMember = invitation
    ? await db.documentMember.findUnique({
        where: {
          documentId_userId: {
            documentId: invitation.documentId,
            userId: user.id,
          },
        },
        select: { id: true },
      })
    : null;

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="rounded-xl border border-zinc-200 bg-white p-8 shadow-sm">
          {!invitation ? (
            <MessageCard
              title="Invitation not found"
              body="This invitation link is invalid or has expired."
              actionHref="/dashboard"
              actionLabel="Go to dashboard"
            />
          ) : invitation.status !== "PENDING" ? (
            <MessageCard
              title="Invitation already used"
              body="This invitation has already been accepted."
              actionHref="/dashboard"
              actionLabel="Go to dashboard"
            />
          ) : isInvitationExpired(invitation.expiresAt) ? (
            <MessageCard
              title="Invitation expired"
              body="This invitation link has expired. Ask the document owner to send a new invitation."
              actionHref="/dashboard"
              actionLabel="Go to dashboard"
            />
          ) : alreadyMember ? (
            <MessageCard
              title="You’re already a member"
              body={`You already have access to “${invitation.document.title}”.`}
              actionHref={`/documents/${invitation.documentId}`}
              actionLabel="Open document"
            />
          ) : (user.email ?? "").toLowerCase() !==
            invitation.email.toLowerCase() ? (
            <WrongAccountCard
              invitedEmail={invitation.email}
              signedInEmail={user.email ?? ""}
              token={token}
            />
          ) : (
            <>
              <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
                You’re invited to “{invitation.document.title}”
              </h1>
              <p className="mt-2 text-sm text-zinc-600">
                Invited by{" "}
                {invitation.invitedBy.name ?? invitation.invitedBy.email}
              </p>
              <span className="mt-4 inline-block rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-700">
                {formatRole(invitation.role)}
              </span>
              <AcceptInvitationForm token={token} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function isInvitationExpired(expiresAt: Date) {
  return expiresAt.getTime() < Date.now();
}

function MessageCard({
  title,
  body,
  actionHref,
  actionLabel,
}: {
  title: string;
  body: string;
  actionHref: string;
  actionLabel: string;
}) {
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
        {title}
      </h1>
      <p className="mt-2 text-sm text-zinc-600">{body}</p>
      <div className="mt-6">
        <Link
          href={actionHref}
          className="block w-full rounded-md bg-zinc-900 px-4 py-2 text-center text-sm font-medium text-white hover:bg-zinc-700"
        >
          {actionLabel}
        </Link>
      </div>
    </>
  );
}

function WrongAccountCard({
  invitedEmail,
  signedInEmail,
  token,
}: {
  invitedEmail: string;
  signedInEmail: string;
  token: string;
}) {
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
        Check your account
      </h1>
      <p className="mt-2 text-sm text-zinc-600">
        This invitation was sent to{" "}
        <span className="font-medium text-zinc-900">{invitedEmail}</span>.
        You’re signed in as{" "}
        <span className="font-medium text-zinc-900">{signedInEmail}</span>. Sign
        out and open the invitation link with the right account.
      </p>
      <div className="mt-6">
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: `/invitations/${token}` });
          }}
        >
          <button
            type="submit"
            className="w-full rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            Sign out
          </button>
        </form>
      </div>
    </>
  );
}