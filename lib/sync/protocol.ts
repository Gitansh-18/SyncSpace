import type { TextPatch } from "./text-operation";

export type PendingSyncOperation = {
  id: string;
  clientId: string;
  baseRevision: number;
  patch: TextPatch;
};

export type SyncRequest = {
  knownRevision: number;
  operations: PendingSyncOperation[];
};

export type RemoteSyncOperation = TextPatch & {
  id: string;
  clientId: string;
  revision: number;
  conflicted: boolean;
  createdAt: string;
};

export type SyncResponse = {
  document: {
    content: string;
    revision: number;
  };
  operations: RemoteSyncOperation[];
  acknowledgedOperationIds: string[];
  hasMore: boolean;
};
