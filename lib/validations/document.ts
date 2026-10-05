import { DocumentRole } from "@prisma/client";
import { z } from "zod";

export const documentIdSchema = z.string().cuid();
export const memberIdSchema = z.string().cuid();

export const createDocumentSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Title is required")
    .max(120, "Title must be 120 characters or fewer"),
});

export const addMemberSchema = z.object({
  documentId: documentIdSchema,
  email: z.string().email("Enter a valid email address"),
  role: z.enum([DocumentRole.EDITOR, DocumentRole.VIEWER]),
});

export const updateMemberRoleSchema = z.object({
  documentId: documentIdSchema,
  memberId: memberIdSchema,
  role: z.enum([DocumentRole.EDITOR, DocumentRole.VIEWER]),
});

export const restoreVersionSchema = z.object({
  documentId: documentIdSchema,
  revision: z.coerce.number().int().min(0),
});

export const deleteDocumentSchema = z.object({
  documentId: documentIdSchema,
});

export type CreateDocumentInput = z.infer<typeof createDocumentSchema>;
export type AddMemberInput = z.infer<typeof addMemberSchema>;
export type UpdateMemberRoleInput = z.infer<typeof updateMemberRoleSchema>;
export type RestoreVersionInput = z.infer<typeof restoreVersionSchema>;
export type DeleteDocumentInput = z.infer<typeof deleteDocumentSchema>;
