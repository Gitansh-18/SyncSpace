import { getLocalDb } from "./database";
import type { LocalDocument, LocalSyncOperation } from "./types";
import type { SyncRequest } from "@/lib/sync/protocol";
import {
  createTextPatch,
  mergeTextPatch,
  type TextPatch,
} from "@/lib/sync/text-operation";
import { syncResponseSchema } from "@/lib/validations/sync";

export type LocalSyncResult = {
  document: LocalDocument | null;
  state: "synced" | "pending" | "error";
  conflicted: boolean;
  unavailable: boolean;
};

const activeSyncs = new Map<string, Promise<LocalSyncResult>>();
const MAX_PAGES_PER_RUN = 5;

export function syncLocalDocument(documentId: string) {
  const activeSync = activeSyncs.get(documentId);

  if (activeSync) {
    return activeSync;
  }

  const sync = performSync(documentId);
  activeSyncs.set(documentId, sync);

  return sync.finally(() => {
    if (activeSyncs.get(documentId) === sync) {
      activeSyncs.delete(documentId);
    }
  });
}

async function performSync(documentId: string): Promise<LocalSyncResult> {
  const db = getLocalDb();

  if (!db) {
    return {
      document: null,
      state: "error",
      conflicted: false,
      unavailable: false,
    };
  }

  if (!navigator.onLine) {
    return {
      document: (await db.documents.get(documentId)) ?? null,
      state: "pending",
      conflicted: false,
      unavailable: false,
    };
  }

  let conflicted = false;

  for (let page = 0; page < MAX_PAGES_PER_RUN; page += 1) {
    const document = await db.documents.get(documentId);

    if (!document) {
      return {
        document: null,
        state: "error",
        conflicted,
        unavailable: false,
      };
    }

    const queuedOperation = await db.operations
      .where("documentId")
      .equals(documentId)
      .first();
    const operation =
      queuedOperation && queuedOperation.nextRetryAt <= Date.now()
        ? queuedOperation
        : null;
    const request: SyncRequest = {
      knownRevision: document.serverRevision,
      operations: operation ? [toPendingOperation(operation)] : [],
    };

    let response: Response;

    try {
      response = await fetch(`/api/documents/${documentId}/sync`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(request),
      });
    } catch {
      await recordFailedAttempt(documentId, operation);

      return {
        document: (await db.documents.get(documentId)) ?? null,
        state: "error",
        conflicted,
        unavailable: false,
      };
    }

    if (response.status === 404) {
      return {
        document: (await db.documents.get(documentId)) ?? null,
        state: "error",
        conflicted,
        unavailable: true,
      };
    }

    if (!response.ok) {
      await recordFailedAttempt(documentId, operation);

      return {
        document: (await db.documents.get(documentId)) ?? null,
        state: "error",
        conflicted,
        unavailable: false,
      };
    }

    let responseBody: unknown;

    try {
      responseBody = await response.json();
    } catch {
      await recordFailedAttempt(documentId, operation);

      return {
        document: (await db.documents.get(documentId)) ?? null,
        state: "error",
        conflicted,
        unavailable: false,
      };
    }

    const parsed = syncResponseSchema.safeParse(responseBody);

    if (!parsed.success) {
      await recordFailedAttempt(documentId, operation);

      return {
        document: (await db.documents.get(documentId)) ?? null,
        state: "error",
        conflicted,
        unavailable: false,
      };
    }

    conflicted ||= parsed.data.operations.some(
      (remoteOperation) => remoteOperation.conflicted,
    );

    const reconciliation = await reconcileSyncResponse({
      documentAtRequest: document,
      operationAtRequest: operation,
      response: parsed.data,
    });
    conflicted ||= reconciliation.conflicted;

    const continueImmediately =
      parsed.data.hasMore || Boolean(reconciliation.document?.dirty);

    if (!continueImmediately) {
      return {
        document: reconciliation.document,
        state: reconciliation.document?.dirty ? "pending" : "synced",
        conflicted,
        unavailable: false,
      };
    }
  }

  const document = (await db.documents.get(documentId)) ?? null;

  return {
    document,
    state: document?.dirty ? "pending" : "synced",
    conflicted,
    unavailable: false,
  };
}

async function reconcileSyncResponse({
  documentAtRequest,
  operationAtRequest,
  response,
}: {
  documentAtRequest: LocalDocument;
  operationAtRequest: LocalSyncOperation | null;
  response: ReturnType<typeof syncResponseSchema.parse>;
}) {
  const db = getLocalDb();

  if (!db) {
    return {
      document: null,
      conflicted: false,
    };
  }

  return db.transaction("rw", db.documents, db.operations, async () => {
    const currentDocument = await db.documents.get(documentAtRequest.id);

    if (!currentDocument) {
      return {
        document: null,
        conflicted: false,
      };
    }

    const currentOperation = await db.operations
      .where("documentId")
      .equals(documentAtRequest.id)
      .first();
    const operationWasAcknowledged = Boolean(
      operationAtRequest &&
        response.acknowledgedOperationIds.includes(operationAtRequest.id),
    );
    const localChangedDuringRequest =
      currentDocument.updatedAt !== documentAtRequest.updatedAt;
    let nextContent = response.document.content;
    let pendingPatch: TextPatch | null = null;
    let localConflict = false;

    if (operationAtRequest && localChangedDuringRequest) {
      const followUpPatch = createTextPatch(
        documentAtRequest.content,
        currentDocument.content,
      );

      if (followUpPatch) {
        const rebased = mergeTextPatch(
          documentAtRequest.content,
          followUpPatch,
          response.document.content,
        );
        nextContent = rebased.content;
        pendingPatch = createTextPatch(
          response.document.content,
          rebased.content,
        );
        localConflict = rebased.conflicted;
      }
    } else if (!operationWasAcknowledged && currentOperation) {
      const rebased = mergeTextPatch(
        currentDocument.syncedContent,
        currentOperation.patch,
        response.document.content,
      );
      nextContent = rebased.content;
      pendingPatch = createTextPatch(
        response.document.content,
        rebased.content,
      );
      localConflict = rebased.conflicted;
    }

    await db.operations.where("documentId").equals(documentAtRequest.id).delete();

    if (pendingPatch) {
      await db.operations.put({
        id: currentOperation?.id ?? crypto.randomUUID(),
        documentId: documentAtRequest.id,
        clientId:
          currentOperation?.clientId ??
          operationAtRequest?.clientId ??
          crypto.randomUUID(),
        baseRevision: response.document.revision,
        patch: pendingPatch,
        createdAt: Date.now(),
        attemptCount: 0,
        nextRetryAt: 0,
      });
    }

    const updatedDocument: LocalDocument = {
      ...currentDocument,
      content: nextContent,
      syncedContent: response.document.content,
      serverRevision: response.document.revision,
      updatedAt: Date.now(),
      dirty: Boolean(pendingPatch),
    };

    await db.documents.put(updatedDocument);

    return {
      document: updatedDocument,
      conflicted: localConflict,
    };
  });
}

async function recordFailedAttempt(
  documentId: string,
  attemptedOperation: LocalSyncOperation | null,
) {
  if (!attemptedOperation) {
    return;
  }

  const db = getLocalDb();

  if (!db) {
    return;
  }

  await db.transaction("rw", db.operations, async () => {
    const currentOperation = await db.operations.get(attemptedOperation.id);

    if (!currentOperation || currentOperation.documentId !== documentId) {
      return;
    }

    const attemptCount = currentOperation.attemptCount + 1;
    const retryDelay = Math.min(30_000, 1_000 * 2 ** (attemptCount - 1));

    await db.operations.update(currentOperation.id, {
      attemptCount,
      nextRetryAt: Date.now() + retryDelay,
    });
  });
}

function toPendingOperation(operation: LocalSyncOperation) {
  return {
    id: operation.id,
    clientId: operation.clientId,
    baseRevision: operation.baseRevision,
    patch: operation.patch,
  };
}
