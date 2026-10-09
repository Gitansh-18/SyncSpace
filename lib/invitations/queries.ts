import { db } from "@/lib/db";
import { hashInvitationToken } from "./security";

export async function getInvitationByToken(token: string) {
  return db.invitation.findUnique({
    where: { tokenHash: hashInvitationToken(token) },
    include: {
      document: {
        select: {
          id: true,
          title: true,
        },
      },
      invitedBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });
}