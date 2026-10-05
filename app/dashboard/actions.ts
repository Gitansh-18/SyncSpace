"use server";

import { DocumentRole } from "@prisma/client";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/require-user";
import { db } from "@/lib/db";
import { createDocumentSchema } from "@/lib/validations/document";

export type CreateDocumentState = {
  error?: string;
};

export async function createDocumentAction(
  _prevState: CreateDocumentState,
  formData: FormData,
): Promise<CreateDocumentState> {
  const user = await requireUser();

  const parsed = createDocumentSchema.safeParse({
    title: formData.get("title"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const document = await db.document.create({
    data: {
      title: parsed.data.title,
      members: {
        create: {
          userId: user.id,
          role: DocumentRole.OWNER,
        },
      },
    },
  });

  redirect(`/documents/${document.id}`);
}
