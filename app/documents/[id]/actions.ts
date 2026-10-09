"use server";

import { DocumentRole, Prisma } from "@prisma/client";
import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/require-user";
import { canEditDocument, canManageMembers } from "@/lib/documents/permissions";
import { getDocumentMembership } from "@/lib/documents/queries";
import { db } from "@/lib/db";
import { buildInvitationUrl, sendInvitationEmail } from "@/lib/invitations/email";
import {
  generateInvitationToken,
  hashInvitationToken,
} from "@/lib/invitations/security";
import { createTextPatch } from "@/lib/sync/text-operation";
import {
  addMemberSchema,
  deleteDocumentSchema,
  documentIdSchema,
  restoreVersionSchema,
  updateMemberRoleSchema,
} from "@/lib/validations/document";

const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type AddMemberState = {
  error?: string;
  success?: string;
};

export type UpdateMemberRoleState = {
  error?: string;
  success?: string;
};

export type DeleteDocumentState = {
  error?: string;
};

export async function addMemberAction(
  _prevState: AddMemberState,
  formData: FormData,
): Promise<AddMemberState> {
  const user = await requireUser();

  const parsed = addMemberSchema.safeParse({
    documentId: formData.get("documentId"),
    email: formData.get("email"),
    role: formData.get("role"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const membership = await getDocumentMembership(user.id, parsed.data.documentId);

  if (!membership || !canManageMembers(membership.role)) {
    return { error: "Only the document owner can add members" };
  }

  const normalizedEmail = parsed.data.email.trim().toLowerCase();

  const invitedUser = await db.user.findFirst({
    where: { email: { equals: normalizedEmail, mode: "insensitive" } },
  });

  if (!invitedUser) {
    return inviteUnregisteredUser({
      documentId: parsed.data.documentId,
      email: normalizedEmail,
      role: parsed.data.role,
      documentTitle: membership.document.title,
      currentUserId: user.id,
      currentUserName: user.name ?? null,
      currentUserEmail: user.email ?? null,
    });
  }

  if (invitedUser.id === user.id) {
    return { error: "You are already a member of this document" };
  }

  const existingMembership = await db.documentMember.findUnique({
    where: {
      documentId_userId: {
        documentId: parsed.data.documentId,
        userId: invitedUser.id,
      },
    },
  });

  if (existingMembership) {
    return {
      error: "That user is already a member. Change their role in the members list below.",
    };
  }

  await db.documentMember.create({
    data: {
      documentId: parsed.data.documentId,
      userId: invitedUser.id,
      role: parsed.data.role,
    },
  });

  revalidatePath(`/documents/${parsed.data.documentId}`);

  return { success: "Member added successfully." };
}

type InviteUnregisteredUserInput = {
  documentId: string;
  email: string;
  role: DocumentRole;
  documentTitle: string;
  currentUserId: string;
  currentUserName: string | null;
  currentUserEmail: string | null;
};

async function inviteUnregisteredUser({
  documentId,
  email,
  role,
  documentTitle,
  currentUserId,
  currentUserName,
  currentUserEmail,
}: InviteUnregisteredUserInput): Promise<AddMemberState> {
  if (currentUserEmail && email === currentUserEmail.toLowerCase()) {
    return { error: "You are already a member of this document" };
  }

  const pendingInvitation = await db.invitation.findFirst({
    where: { documentId, email, status: "PENDING" },
    select: { id: true },
  });

  if (pendingInvitation) {
    return { error: "An invitation has already been sent to this email." };
  }

  const token = generateInvitationToken();
  const expiresAt = new Date(Date.now() + INVITATION_TTL_MS);

  let invitationId: string;

  try {
    const invitation = await db.invitation.create({
      data: {
        documentId,
        email,
        role,
        tokenHash: hashInvitationToken(token),
        invitedById: currentUserId,
        expiresAt,
      },
      select: { id: true },
    });
    invitationId = invitation.id;
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      // Two invites for the same document+email arrived at once; the partial
      // unique index guarantees only one stays pending.
      return { error: "An invitation has already been sent to this email." };
    }
    throw error;
  }

  try {
    await sendInvitationEmail({
      to: email,
      documentTitle,
      inviterName: currentUserName,
      inviteUrl: buildInvitationUrl(token),
      role,
    });
  } catch (error) {
    console.error("Failed to send invitation email", error);
    await db.invitation
      .delete({ where: { id: invitationId } })
      .catch(() => undefined);
    return { error: "We couldn't send the invitation email. Please try again." };
  }

  return { success: `Invitation sent to ${email}.` };
}

export async function updateMemberRoleAction(formData: FormData) {
  const user = await requireUser();

  const parsed = updateMemberRoleSchema.safeParse({
    documentId: formData.get("documentId"),
    memberId: formData.get("memberId"),
    role: formData.get("role"),
  });

  if (!parsed.success) {
    redirectToDocumentOrDashboard(formData.get("documentId"));
  }

  const membership = await getDocumentMembership(user.id, parsed.data.documentId);

  if (!membership || !canManageMembers(membership.role)) {
    redirect(`/documents/${parsed.data.documentId}`);
  }

  const targetMember = await db.documentMember.findFirst({
    where: {
      id: parsed.data.memberId,
      documentId: parsed.data.documentId,
      role: { not: DocumentRole.OWNER },
    },
  });

  if (!targetMember) {
    redirect(`/documents/${parsed.data.documentId}`);
  }

  await db.documentMember.update({
    where: { id: targetMember.id },
    data: { role: parsed.data.role },
  });

  revalidatePath(`/documents/${parsed.data.documentId}`);
  redirect(`/documents/${parsed.data.documentId}`);
}

export async function updateMemberRoleStateAction(
  _prevState: UpdateMemberRoleState,
  formData: FormData,
): Promise<UpdateMemberRoleState> {
  const user = await requireUser();

  const parsed = updateMemberRoleSchema.safeParse({
    documentId: formData.get("documentId"),
    memberId: formData.get("memberId"),
    role: formData.get("role"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const membership = await getDocumentMembership(user.id, parsed.data.documentId);

  if (!membership || !canManageMembers(membership.role)) {
    return { error: "Only the document owner can change member roles" };
  }

  const targetMember = await db.documentMember.findFirst({
    where: {
      id: parsed.data.memberId,
      documentId: parsed.data.documentId,
      role: { not: DocumentRole.OWNER },
    },
    select: {
      id: true,
      role: true,
    },
  });

  if (!targetMember) {
    return { error: "Member not found" };
  }

  if (targetMember.role !== parsed.data.role) {
    await db.documentMember.update({
      where: { id: targetMember.id },
      data: { role: parsed.data.role },
    });
  }

  revalidatePath(`/documents/${parsed.data.documentId}`);

  return { success: `Role updated to ${parsed.data.role.toLowerCase()}.` };
}

export async function deleteDocumentAction(formData: FormData) {
  const user = await requireUser();
  const parsed = deleteDocumentSchema.safeParse({
    documentId: formData.get("documentId"),
  });

  if (!parsed.success) {
    redirect("/dashboard");
  }

  const { documentId } = parsed.data;
  const membership = await getDocumentMembership(user.id, documentId);

  if (!membership || membership.role !== "OWNER") {
    redirect(`/documents/${documentId}`);
  }

  await db.document.delete({
    where: { id: documentId },
  });

  redirect("/dashboard");
}

export async function deleteDocumentStateAction(
  _prevState: DeleteDocumentState,
  formData: FormData,
): Promise<DeleteDocumentState> {
  const user = await requireUser();
  const parsed = deleteDocumentSchema.safeParse({
    documentId: formData.get("documentId"),
  });

  if (!parsed.success) {
    return { error: "Invalid document id" };
  }

  const { documentId } = parsed.data;
  const membership = await getDocumentMembership(user.id, documentId);

  if (!membership || membership.role !== "OWNER") {
    return { error: "Only the document owner can delete this document" };
  }

  await db.document.delete({
    where: { id: documentId },
  });

  revalidatePath("/dashboard");
  redirect("/dashboard");
}

export async function restoreVersionAction(formData: FormData) {
  const user = await requireUser();

  const parsed = restoreVersionSchema.safeParse({
    documentId: formData.get("documentId"),
    revision: formData.get("revision"),
  });

  if (!parsed.success) {
    redirect("/dashboard");
  }

  const { documentId, revision } = parsed.data;

  await db.$transaction(
    async (transaction) => {
      const membership = await transaction.documentMember.findUnique({
        where: {
          documentId_userId: {
            documentId,
            userId: user.id,
          },
        },
        select: {
          role: true,
        },
      });

      if (!membership || !canEditDocument(membership.role)) {
        return;
      }

      const document = await transaction.document.findUnique({
        where: { id: documentId },
        select: {
          id: true,
          content: true,
          initialContent: true,
          revision: true,
        },
      });

      if (!document || revision > document.revision) {
        return;
      }

      const restoredContent =
        revision === 0
          ? document.initialContent
          : (
              await transaction.documentOperation.findUnique({
                where: {
                  documentId_revision: {
                    documentId,
                    revision,
                  },
                },
                select: {
                  content: true,
                },
              })
            )?.content;

      if (typeof restoredContent !== "string") {
        return;
      }

      const patch = createTextPatch(document.content, restoredContent);

      if (!patch) {
        return;
      }

      const nextRevision = document.revision + 1;

      await transaction.document.update({
        where: { id: documentId },
        data: {
          content: restoredContent,
          revision: nextRevision,
        },
      });

      await transaction.documentOperation.create({
        data: {
          id: randomUUID(),
          documentId,
          userId: user.id,
          clientId: "server-version-restore",
          baseRevision: document.revision,
          revision: nextRevision,
          start: patch.start,
          deleteCount: patch.deleteCount,
          insertText: patch.insertText,
          content: restoredContent,
        },
      });
    },
    {
      maxWait: 10_000,
      timeout: 15_000,
    },
  );

  revalidatePath(`/documents/${documentId}`);
  redirect(`/documents/${documentId}`);
}

function redirectToDocumentOrDashboard(
  rawDocumentId: FormDataEntryValue | null,
): never {
  const parsed = documentIdSchema.safeParse(rawDocumentId);

  if (!parsed.success) {
    redirect("/dashboard");
  }

  redirect(`/documents/${parsed.data}`);
}
