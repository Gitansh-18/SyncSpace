import "fake-indexeddb/auto";

import { beforeEach, describe, expect, it, vi } from "vitest";
import { getLocalDb } from "./database";
import { loadOrSeedDocument, saveLocalContent } from "./document-store";
import { syncLocalDocument } from "./sync-engine";
import type { PendingSyncOperation, SyncResponse } from "@/lib/sync/protocol";

const documentId = "document-1";

describe("syncLocalDocument", () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    vi.stubGlobal("navigator", { onLine: true });
    vi.stubGlobal("window", {
      localStorage: createMemoryStorage(),
    });

    const db = getLocalDb();
    await db?.documents.clear();
    await db?.operations.clear();
  });

  it("pushes a queued local edit and marks the document clean after acknowledgement", async () => {
    await loadOrSeedDocument(documentId, {
      title: "Planning Notes",
      content: "Hello",
      revision: 0,
    });
    await saveLocalContent(documentId, "Hello world");

    const db = getLocalDb();
    const queuedOperation = await db?.operations
      .where("documentId")
      .equals(documentId)
      .first();

    expect(queuedOperation).toBeDefined();

    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const request = JSON.parse(String(init?.body)) as {
        knownRevision: number;
        operations: PendingSyncOperation[];
      };

      expect(request.knownRevision).toBe(0);
      expect(request.operations).toHaveLength(1);

      return jsonResponse({
        document: {
          content: "Hello world",
          revision: 1,
        },
        operations: [
          {
            ...request.operations[0].patch,
            id: request.operations[0].id,
            clientId: request.operations[0].clientId,
            revision: 1,
            conflicted: false,
            createdAt: new Date().toISOString(),
          },
        ],
        acknowledgedOperationIds: [request.operations[0].id],
        hasMore: false,
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await syncLocalDocument(documentId);
    const document = await db?.documents.get(documentId);
    const remainingOperation = await db?.operations
      .where("documentId")
      .equals(documentId)
      .first();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.state).toBe("synced");
    expect(document?.content).toBe("Hello world");
    expect(document?.syncedContent).toBe("Hello world");
    expect(document?.serverRevision).toBe(1);
    expect(document?.dirty).toBe(false);
    expect(remainingOperation).toBeUndefined();
  });

  it("records retry metadata when a push request fails", async () => {
    await loadOrSeedDocument(documentId, {
      title: "Planning Notes",
      content: "Draft",
      revision: 0,
    });
    await saveLocalContent(documentId, "Draft with local edits");

    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({}, 500)));

    const result = await syncLocalDocument(documentId);
    const db = getLocalDb();
    const operation = await db?.operations
      .where("documentId")
      .equals(documentId)
      .first();

    expect(result.state).toBe("error");
    expect(operation?.attemptCount).toBe(1);
    expect(operation?.nextRetryAt).toBeGreaterThan(Date.now());
  });

  it("reports when the document is no longer available", async () => {
    await loadOrSeedDocument(documentId, {
      title: "Planning Notes",
      content: "Draft",
      revision: 0,
    });

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ error: "Document not found" }, 404)),
    );

    const result = await syncLocalDocument(documentId);

    expect(result.state).toBe("error");
    expect(result.unavailable).toBe(true);
  });

  it("rebases an edit made while the previous sync request is in flight", async () => {
    await loadOrSeedDocument(documentId, {
      title: "Planning Notes",
      content: "Alpha",
      revision: 0,
    });
    await saveLocalContent(documentId, "Alpha beta");

    let firstRequestSent: (() => void) | null = null;
    const firstRequestStarted = new Promise<void>((resolve) => {
      firstRequestSent = resolve;
    });
    const firstResponseReady = createDeferred<void>();
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(async (_url: string, init?: RequestInit) => {
        const request = JSON.parse(String(init?.body)) as {
          operations: PendingSyncOperation[];
        };

        firstRequestSent?.();
        await firstResponseReady.promise;

        return jsonResponse({
          document: {
            content: "Alpha beta",
            revision: 1,
          },
          operations: [
            {
              ...request.operations[0].patch,
              id: request.operations[0].id,
              clientId: request.operations[0].clientId,
              revision: 1,
              conflicted: false,
              createdAt: new Date().toISOString(),
            },
          ],
          acknowledgedOperationIds: [request.operations[0].id],
          hasMore: false,
        });
      })
      .mockImplementationOnce(async (_url: string, init?: RequestInit) => {
        const request = JSON.parse(String(init?.body)) as {
          knownRevision: number;
          operations: PendingSyncOperation[];
        };

        expect(request.knownRevision).toBe(1);
        expect(request.operations).toHaveLength(1);

        return jsonResponse({
          document: {
            content: "Alpha beta gamma",
            revision: 2,
          },
          operations: [
            {
              ...request.operations[0].patch,
              id: request.operations[0].id,
              clientId: request.operations[0].clientId,
              revision: 2,
              conflicted: false,
              createdAt: new Date().toISOString(),
            },
          ],
          acknowledgedOperationIds: [request.operations[0].id],
          hasMore: false,
        });
      });
    vi.stubGlobal("fetch", fetchMock);

    const sync = syncLocalDocument(documentId);
    await firstRequestStarted;
    await saveLocalContent(documentId, "Alpha beta gamma");
    firstResponseReady.resolve();

    const result = await sync;
    const db = getLocalDb();
    const document = await db?.documents.get(documentId);
    const remainingOperation = await db?.operations
      .where("documentId")
      .equals(documentId)
      .first();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.state).toBe("synced");
    expect(document?.content).toBe("Alpha beta gamma");
    expect(document?.syncedContent).toBe("Alpha beta gamma");
    expect(document?.serverRevision).toBe(2);
    expect(document?.dirty).toBe(false);
    expect(remainingOperation).toBeUndefined();
  });
});

function jsonResponse(body: SyncResponse | object, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

function createMemoryStorage(): Storage {
  const values = new Map<string, string>();

  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, value),
  };
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve;
  });

  return {
    promise,
    resolve,
  };
}
