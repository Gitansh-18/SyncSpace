import { z } from "zod";

export const MAX_DOCUMENT_LENGTH = 100_000;
export const MAX_SYNC_PAYLOAD_BYTES = 256_000;
export const SYNC_OPERATION_PAGE_SIZE = 50;

const textPatchSchema = z
  .object({
    start: z.number().int().min(0).max(MAX_DOCUMENT_LENGTH),
    deleteCount: z.number().int().min(0).max(MAX_DOCUMENT_LENGTH),
    insertText: z.string().max(MAX_DOCUMENT_LENGTH),
  })
  .strict();

export const syncRequestSchema = z
  .object({
    knownRevision: z.number().int().min(0),
    operations: z
      .array(
        z
          .object({
            id: z.string().uuid(),
            clientId: z.string().min(1).max(64),
            baseRevision: z.number().int().min(0),
            patch: textPatchSchema,
          })
          .strict(),
      )
      .max(1),
  })
  .strict();

export const syncResponseSchema = z
  .object({
    document: z
      .object({
        content: z.string().max(MAX_DOCUMENT_LENGTH),
        revision: z.number().int().min(0),
      })
      .strict(),
    operations: z.array(
      textPatchSchema
        .extend({
          id: z.string().uuid(),
          clientId: z.string().min(1).max(64),
          revision: z.number().int().min(1),
          conflicted: z.boolean(),
          createdAt: z.string(),
        })
        .strict(),
    ),
    acknowledgedOperationIds: z.array(z.string().uuid()),
    hasMore: z.boolean(),
  })
  .strict();
