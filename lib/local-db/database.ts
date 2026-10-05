import Dexie, { type Table } from "dexie";
import type { LocalDocument, LocalSyncOperation } from "./types";

class CollabEditorDB extends Dexie {
  documents!: Table<LocalDocument, string>;
  operations!: Table<LocalSyncOperation, string>;

  constructor() {
    super("collab-editor");

    this.version(1).stores({
      documents: "id, updatedAt",
    });

    this.version(2).stores({
      documents: "id, updatedAt",
      operations: "id, &documentId, nextRetryAt",
    });
  }
}

let database: CollabEditorDB | null = null;

export function getLocalDb() {
  if (typeof window === "undefined") {
    return null;
  }

  if (!database) {
    database = new CollabEditorDB();
  }

  return database;
}
