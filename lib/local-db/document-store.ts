import { getLocalDb } from "./database";
import type { LocalDocument } from "./types";
import { createTextPatch } from "@/lib/sync/text-operation";

type ServerSnapshot = {
  title: string;
  content: string;
  revision: number;
};

const CLIENT_ID_KEY = "collab-editor-client-id";

export async function loadOrSeedDocument(
  documentId: string,
  serverSnapshot: ServerSnapshot,
): Promise<LocalDocument> {
  const db = getLocalDb();

  if (!db) {
    return {
      id: documentId,
      title: serverSnapshot.title,
      content: serverSnapshot.content,
      syncedContent: serverSnapshot.content,
      serverRevision: serverSnapshot.revision,
      updatedAt: Date.now(),
      dirty: false,
    };
  }

  const existing = await db.documents.get(documentId);

  if (existing) {
    if (
      typeof existing.serverRevision === "number" &&
      typeof existing.syncedContent === "string"
    ) {
      return existing;
    }

    const upgraded: LocalDocument = {
      ...existing,
      syncedContent: serverSnapshot.content,
      serverRevision: serverSnapshot.revision,
    };

    await db.documents.put(upgraded);
    return upgraded;
  }

  const seeded: LocalDocument = {
    id: documentId,
    title: serverSnapshot.title,
    content: serverSnapshot.content,
    syncedContent: serverSnapshot.content,
    serverRevision: serverSnapshot.revision,
    updatedAt: Date.now(),
    dirty: false,
  };

  await db.documents.put(seeded);
  return seeded;
}

export async function saveLocalContent(documentId: string, content: string) {
  const db = getLocalDb();

  if (!db) {
    return;
  }

  return db.transaction("rw", db.documents, db.operations, async () => {
    const existing = await db.documents.get(documentId);

    if (!existing) {
      return;
    }

    const previousOperation = await db.operations
      .where("documentId")
      .equals(documentId)
      .first();
    const patch = createTextPatch(existing.syncedContent, content);
    const updatedAt = Date.now();

    if (previousOperation) {
      await db.operations.delete(previousOperation.id);
    }

    if (patch) {
      await db.operations.put({
        id: crypto.randomUUID(),
        documentId,
        clientId: getClientId(),
        baseRevision: existing.serverRevision,
        patch,
        createdAt: updatedAt,
        attemptCount: 0,
        nextRetryAt: 0,
      });
    }

    const updated: LocalDocument = {
      ...existing,
      content,
      updatedAt,
      dirty: Boolean(patch),
    };

    await db.documents.put(updated);
    return updated;
  });
}

function getClientId() {
  const existing = window.localStorage.getItem(CLIENT_ID_KEY);

  if (existing) {
    return existing;
  }

  const clientId = crypto.randomUUID();
  window.localStorage.setItem(CLIENT_ID_KEY, clientId);
  return clientId;
}
