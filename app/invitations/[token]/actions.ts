"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/require-user";
import { db } from "@/lib/db";
import { getInvitationByToken } from "@/lib/invitations/queries";
import { invitationTokenSchema } from "@/lib/validations/invitation";

export type AcceptInvitationState = {
  error?: string;
};

export async function acceptInvitationAction(
  _prevState: AcceptInvitationState,
  formData: FormData,
): Promise<AcceptInvitationState> {
  const user = await requireUser();

  const parsed = invitationTokenSchema.safeParse(formData.get("token"));

  if (!parsed.success) {
    return { error: "This invitation link is invalid." };
  }

  const invitation = await getInvitationByToken(parsed.data);

  if (!invitation) {
    return { error: "This invitation link is invalid or has expired." };
  }

  if (invitation.status !== "PENDING") {
    return { error: "This invitation has already been used." };
  }

  if (invitation.expiresAt.getTime() < Date.now()) {
    return { error: "This invitation has expired." };
  }

  if ((user.email ?? "").toLowerCase() !== invitation.email.toLowerCase()) {
    return {
      error: `This invitation was sent to ${invitation.email}. Sign out and open the link with that account.`,
    };
  }

  try {
    await db.$transaction(
      async (transaction) => {
        await transaction.documentMember.upsert({
          where: {
            documentId_userId: {
              documentId: invitation.documentId,
              userId: user.id,
            },
          },
          create: {
            documentId: invitation.documentId,
            userId: user.id,
            role: invitation.role,
          },
          update: {},
        });

        await transaction.invitation.update({
          where: { id: invitation.id },
          data: { status: "ACCEPTED" },
        });
      },
      {
        maxWait: 10_000,
        timeout: 15_000,
      },
    );
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      // Another request accepted at the same time; send the user to the
      // document instead of treating this as a failure.
      redirect(`/documents/${invitation.documentId}`);
    }
    throw error;
  }

  revalidatePath("/dashboard");
  revalidatePath(`/documents/${invitation.documentId}`);

  redirect(`/documents/${invitation.documentId}`);
}