import { DocumentRole, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import type { PendingSyncOperation, SyncResponse } from "./protocol";
import {
  createTextPatch,
  mergeTextPatch,
  type TextPatch,
} from "./text-operation";
import {
  MAX_DOCUMENT_LENGTH,
  SYNC_OPERATION_PAGE_SIZE,
} from "@/lib/validations/sync";

type SyncDocumentInput = {
  documentId: string;
  userId: string;
  knownRevision: number;
  operations: PendingSyncOperation[];
};

export class SyncServerError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

class RetryableSyncError extends Error {}

export async function syncDocument({
  documentId,
  userId,
  knownRevision,
  operations,
}: SyncDocumentInput): Promise<SyncResponse> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await db.$transaction(
        async (transaction) => {
          const membership = await transaction.documentMember.findUnique({
            where: {
              documentId_userId: {
                documentId,
                userId,
              },
            },
            select: { role: true },
          });

          if (!membership) {
            throw new SyncServerError("Document not found", 404);
          }

          if (
            operations.length > 0 &&
            membership.role === DocumentRole.VIEWER
          ) {
            throw new SyncServerError(
              "Viewers cannot submit document changes",
              403,
            );
          }

          const document = await transaction.document.findUnique({
            where: { id: documentId },
            select: {
              content: true,
              initialContent: true,
              revision: true,
            },
          });

          if (!document) {
            throw new SyncServerError("Document not found", 404);
          }

          if (knownRevision > document.revision) {
            throw new SyncServerError(
              "Client revision is newer than the server",
              409,
            );
          }

          let currentContent = document.content;
          let currentRevision = document.revision;
          const acknowledgedOperationIds: string[] = [];

          for (const operation of operations) {
            const existingOperation =
              await transaction.documentOperation.findUnique({
                where: { id: operation.id },
                select: {
                  documentId: true,
                  userId: true,
                },
              });

            if (existingOperation) {
              if (
                existingOperation.documentId !== documentId ||
                existingOperation.userId !== userId
              ) {
                throw new SyncServerError("Operation ID is already in use", 409);
              }

              acknowledgedOperationIds.push(operation.id);
              continue;
            }

            if (operation.baseRevision > currentRevision) {
              throw new SyncServerError(
                "Operation base revision is newer than the server",
                409,
              );
            }

            const baseContent = await getRevisionContent(
              transaction,
              documentId,
              document.initialContent,
              operation.baseRevision,
            );
            const merged = mergeTextPatch(
              baseContent,
              operation.patch,
              currentContent,
            );

            if (merged.content.length > MAX_DOCUMENT_LENGTH) {
              throw new SyncServerError(
                "Document exceeds the maximum size",
                413,
              );
            }

            const appliedPatch =
              createTextPatch(currentContent, merged.content) ?? emptyPatch();
            const nextRevision = currentRevision + 1;
            const updated = await transaction.document.updateMany({
              where: {
                id: documentId,
                revision: currentRevision,
              },
              data: {
                content: merged.content,
                revision: nextRevision,
              },
            });

            if (updated.count !== 1) {
              throw new RetryableSyncError();
            }

            await transaction.documentOperation.create({
              data: {
                id: operation.id,
                documentId,
                userId,
                clientId: operation.clientId,
                baseRevision: operation.baseRevision,
                revision: nextRevision,
                ...appliedPatch,
                content: merged.content,
                conflicted: merged.conflicted,
              },
            });

            currentContent = merged.content;
            currentRevision = nextRevision;
            acknowledgedOperationIds.push(operation.id);
          }

          const operationPage =
            await transaction.documentOperation.findMany({
              where: {
                documentId,
                revision: { gt: knownRevision },
              },
              orderBy: { revision: "asc" },
              take: SYNC_OPERATION_PAGE_SIZE + 1,
              select: {
                id: true,
                clientId: true,
                revision: true,
                start: true,
                deleteCount: true,
                insertText: true,
                conflicted: true,
                createdAt: true,
              },
            });
          const hasMore = operationPage.length > SYNC_OPERATION_PAGE_SIZE;
          const returnedOperations = operationPage.slice(
            0,
            SYNC_OPERATION_PAGE_SIZE,
          );
          const lastOperation =
            returnedOperations[returnedOperations.length - 1];
          const responseContent =
            lastOperation && lastOperation.revision !== currentRevision
              ? (
                  await transaction.documentOperation.findUnique({
                    where: { id: lastOperation.id },
                    select: { content: true },
                  })
                )?.content ?? currentContent
              : currentContent;

          return {
            document: {
              content: responseContent,
              revision: lastOperation?.revision ?? currentRevision,
            },
            operations: returnedOperations.map((operation) => ({
              id: operation.id,
              clientId: operation.clientId,
              revision: operation.revision,
              start: operation.start,
              deleteCount: operation.deleteCount,
              insertText: operation.insertText,
              conflicted: operation.conflicted,
              createdAt: operation.createdAt.toISOString(),
            })),
            acknowledgedOperationIds,
            hasMore,
          };
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        },
      );
    } catch (error) {
      if (isRetryableError(error) && attempt < 2) {
        continue;
      }

      throw error;
    }
  }

  throw new SyncServerError("Could not complete synchronization", 503);
}

async function getRevisionContent(
  transaction: Prisma.TransactionClient,
  documentId: string,
  initialContent: string,
  revision: number,
) {
  if (revision === 0) {
    return initialContent;
  }

  const operation = await transaction.documentOperation.findUnique({
    where: {
      documentId_revision: {
        documentId,
        revision,
      },
    },
    select: { content: true },
  });

  if (!operation) {
    throw new SyncServerError("Operation base revision is unavailable", 409);
  }

  return operation.content;
}

function emptyPatch(): TextPatch {
  return {
    start: 0,
    deleteCount: 0,
    insertText: "",
  };
}

function isRetryableError(error: unknown) {
  return (
    error instanceof RetryableSyncError ||
    (error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2034")
  );
}
