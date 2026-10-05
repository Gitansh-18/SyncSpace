import type { TextPatch } from "@/lib/sync/text-operation";

export type LocalDocument = {
  id: string;
  title: string;
  content: string;
  syncedContent: string;
  serverRevision: number;
  updatedAt: number;
  dirty: boolean;
};

export type LocalSyncOperation = {
  id: string;
  documentId: string;
  clientId: string;
  baseRevision: number;
  patch: TextPatch;
  createdAt: number;
  attemptCount: number;
  nextRetryAt: number;
};
