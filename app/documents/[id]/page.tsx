import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/require-user";
import {
  canEditDocument,
  canManageMembers,
  formatRole,
} from "@/lib/documents/permissions";
import {
  getDocumentMembership,
  getDocumentVersions,
} from "@/lib/documents/queries";
import { DocumentRole } from "@prisma/client";
import { DocumentEditor } from "@/components/documents/document-editor";
import { AddMemberForm } from "./add-member-form";
import { AiAssistant } from "./ai-assistant";
import { DeleteDocumentForm } from "./delete-document-form";
import { MemberRoleForm } from "./member-role-form";
import { VersionHistory } from "./version-history";

type DocumentPageProps = {
  params: Promise<{ id: string }>;
};

export default async function DocumentPage({ params }: DocumentPageProps) {
  const user = await requireUser();
  const { id } = await params;

  const membership = await getDocumentMembership(user.id, id);

  if (!membership) {
    redirect("/dashboard");
  }

  const { document } = membership;
  const userCanEdit = canEditDocument(membership.role);
  const userCanManageMembers = canManageMembers(membership.role);
  const currentUserLabel = user.name ?? user.email ?? "Me";
  const versions = await getDocumentVersions(user.id, id);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-12 sm:px-6">
      <Link
        href="/dashboard"
        className="text-sm text-zinc-600 hover:text-zinc-900"
      >
        ← Back to dashboard
      </Link>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
            {document.title}
          </h1>
          <p className="mt-2 text-sm text-zinc-600">
            Your role:{" "}
            <span className="font-medium text-zinc-900">
              {formatRole(membership.role)}
            </span>
          </p>
        </div>

        {userCanManageMembers ? (
          <DeleteDocumentForm documentId={document.id} />
        ) : null}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[2fr_1fr]">
        <section className="rounded-lg border border-zinc-200 bg-white p-6">
          <h2 className="text-sm font-medium text-zinc-900">Content</h2>
          {userCanEdit ? (
            <p className="mt-2 text-sm text-zinc-600">
              Edits save locally first, then sync to the server in the background.
            </p>
          ) : (
            <p className="mt-2 text-sm text-amber-700">
              You have view-only access. Viewers cannot edit document content.
            </p>
          )}
          <DocumentEditor
            documentId={document.id}
            serverTitle={document.title}
            serverContent={document.content}
            serverRevision={document.revision}
            currentUserLabel={currentUserLabel}
            canEdit={userCanEdit}
          />
        </section>

        <aside className="space-y-6">
          <AiAssistant documentId={document.id} canEdit={userCanEdit} />

          <section className="rounded-lg border border-zinc-200 bg-white p-6">
            <h2 className="text-sm font-medium text-zinc-900">Members</h2>
            <ul className="mt-3 space-y-4">
              {document.members.map((member) => (
                <li key={member.id} className="space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-zinc-900">
                        {member.user.name ?? member.user.email}
                      </p>
                      <p className="text-xs text-zinc-500">{member.user.email}</p>
                    </div>
                    <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700">
                      {formatRole(member.role)}
                    </span>
                  </div>
                  {userCanManageMembers && member.role !== DocumentRole.OWNER ? (
                    <MemberRoleForm
                      documentId={document.id}
                      memberId={member.id}
                      currentRole={member.role}
                    />
                  ) : null}
                </li>
              ))}
            </ul>
          </section>

          {userCanManageMembers ? (
            <section className="rounded-lg border border-zinc-200 bg-white p-6">
              <h2 className="text-sm font-medium text-zinc-900">Add member</h2>
              <p className="mt-1 text-xs text-zinc-500">
                Invite an existing user by email. Editors can edit; viewers are read-only.
              </p>
              <div className="mt-4">
                <AddMemberForm documentId={document.id} />
              </div>
            </section>
          ) : null}

          <VersionHistory
            documentId={document.id}
            role={membership.role}
            versions={versions}
          />
        </aside>
      </div>
    </div>
  );
}
