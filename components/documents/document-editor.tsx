"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ConnectionStatus } from "@/components/documents/connection-status";
import {
  loadOrSeedDocument,
  saveLocalContent,
} from "@/lib/local-db/document-store";
import { syncLocalDocument } from "@/lib/local-db/sync-engine";

type DocumentEditorProps = {
  documentId: string;
  serverTitle: string;
  serverContent: string;
  serverRevision: number;
  currentUserLabel: string;
  canEdit: boolean;
};

type LocalSaveStatus = "saved" | "pending" | "saving" | "error";
type SyncStatus = "synced" | "syncing" | "pending" | "error" | "conflict";

export function DocumentEditor({
  documentId,
  serverTitle,
  serverContent,
  serverRevision,
  currentUserLabel,
  canEdit,
}: DocumentEditorProps) {
  const router = useRouter();
  const [content, setContent] = useState(serverContent);
  const [ready, setReady] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [saveStatus, setSaveStatus] = useState<LocalSaveStatus>("saved");
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("pending");
  const skipNextSave = useRef(true);
  const editVersion = useRef(0);
  const saveTimer = useRef<number | null>(null);
  const saveQueue = useRef<Promise<unknown>>(Promise.resolve());

  const runSync = useCallback(async () => {
    const versionAtStart = editVersion.current;
    setSyncStatus(navigator.onLine ? "syncing" : "pending");

    const result = await syncLocalDocument(documentId);

    if (result.unavailable) {
      router.replace("/dashboard");
      return;
    }

    const syncedDocument = result.document;

    if (syncedDocument && versionAtStart === editVersion.current) {
      setContent((currentContent) => {
        if (currentContent === syncedDocument.content) {
          return currentContent;
        }

        skipNextSave.current = true;
        return syncedDocument.content;
      });
    }

    if (result.conflicted) {
      setSyncStatus("conflict");
    } else {
      setSyncStatus(result.state);
    }
  }, [documentId, router]);

  useEffect(() => {
    let cancelled = false;

    loadOrSeedDocument(documentId, {
      title: serverTitle,
      content: serverContent,
      revision: serverRevision,
    }).then((document) => {
      if (!cancelled) {
        setContent(document.content);
        setLastSavedAt(document.dirty ? document.updatedAt : null);
        setSaveStatus("saved");
        setSyncStatus(document.dirty ? "pending" : "synced");
        setReady(true);
      }
    }).catch(() => {
      if (!cancelled) {
        setSaveStatus("error");
        setReady(true);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [documentId, serverTitle, serverContent, serverRevision]);

  useEffect(() => {
    if (!ready) {
      return;
    }

    const sync = () => {
      runSync().catch(() => setSyncStatus("error"));
    };

    sync();
    const interval = window.setInterval(sync, 5_000);
    window.addEventListener("online", sync);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("online", sync);
    };
  }, [ready, runSync]);

  const persistLocally = useCallback(
    async (value: string, version: number) => {
      if (version === editVersion.current) {
        setSaveStatus("saving");
      }

      const save = saveQueue.current.then(() =>
        saveLocalContent(documentId, value),
      );
      saveQueue.current = save.catch(() => undefined);

      try {
        await save;

        if (version === editVersion.current) {
          setLastSavedAt(Date.now());
          setSaveStatus("saved");
        }

        runSync().catch(() => setSyncStatus("error"));
      } catch {
        if (version === editVersion.current) {
          setSaveStatus("error");
        }
      }
    },
    [documentId, runSync],
  );

  useEffect(() => {
    if (!ready || !canEdit) {
      return;
    }

    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }

    const version = editVersion.current;
    saveTimer.current = window.setTimeout(() => {
      saveTimer.current = null;
      persistLocally(content, version);
    }, 400);

    return () => {
      if (saveTimer.current !== null) {
        window.clearTimeout(saveTimer.current);
        saveTimer.current = null;
      }
    };
  }, [content, ready, canEdit, persistLocally]);

  useEffect(() => {
    if (!ready || !canEdit) {
      return;
    }

    const handleSaveShortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();

        if (saveTimer.current !== null) {
          window.clearTimeout(saveTimer.current);
          saveTimer.current = null;
        }

        persistLocally(content, editVersion.current);
      }
    };

    window.addEventListener("keydown", handleSaveShortcut);
    return () => window.removeEventListener("keydown", handleSaveShortcut);
  }, [content, ready, canEdit, persistLocally]);

  useEffect(() => {
    if (!["pending", "saving", "error"].includes(saveStatus)) {
      return;
    }

    const warnAboutUnsavedChanges = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };

    window.addEventListener("beforeunload", warnAboutUnsavedChanges);
    return () =>
      window.removeEventListener("beforeunload", warnAboutUnsavedChanges);
  }, [saveStatus]);

  const saveNow = () => {
    if (saveTimer.current !== null) {
      window.clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }

    persistLocally(content, editVersion.current);
  };

  const insertAuthorPrefix = () => {
    const prefix = `${currentUserLabel}: `;
    const needsNewLine = content.length > 0 && !content.endsWith("\n");
    const nextContent = `${content}${needsNewLine ? "\n" : ""}${prefix}`;

    editVersion.current += 1;
    setContent(nextContent);
    setSaveStatus("pending");
  };

  const saveStatusText = {
    saved: lastSavedAt
      ? `Saved locally${lastSavedAt ? ` · ${new Date(lastSavedAt).toLocaleTimeString()}` : ""}`
      : "Loaded from local storage",
    pending: "Unsaved changes",
    saving: "Saving locally...",
    error: "Local save failed — keep this tab open",
  }[saveStatus];

  const syncStatusText = {
    synced: "All changes synced",
    syncing: "Syncing...",
    pending: "Waiting to sync",
    error: "Sync failed — retrying",
    conflict: "Conflict merged — review the document",
  }[syncStatus];

  if (!ready) {
    return (
      <p className="mt-4 text-sm text-zinc-500">Loading from local storage...</p>
    );
  }

  if (!canEdit) {
    return (
      <div className="mt-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <ConnectionStatus />
          <p
            role="status"
            aria-live="polite"
            className="text-xs text-zinc-500"
          >
            {syncStatusText}
          </p>
        </div>
        <pre className="min-h-40 whitespace-pre-wrap rounded-md border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-800">
          {content || "Empty document"}
        </pre>
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <ConnectionStatus />
          <p
            id="sync-status"
            role="status"
            aria-live="polite"
            className={
              syncStatus === "error" || syncStatus === "conflict"
                ? "text-xs text-amber-700"
                : "text-xs text-zinc-500"
            }
          >
            {syncStatusText}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <p
            id="local-save-status"
            role="status"
            aria-live="polite"
            className={
              saveStatus === "error"
                ? "text-xs text-red-700"
                : saveStatus === "pending"
                  ? "text-xs text-amber-700"
                  : "text-xs text-zinc-500"
            }
          >
            {saveStatusText}
          </p>
          <button
            type="button"
            onClick={saveNow}
            disabled={saveStatus === "saving"}
            aria-keyshortcuts="Control+S Meta+S"
            className="rounded-md border border-zinc-200 px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Save now
          </button>
          <button
            type="button"
            onClick={insertAuthorPrefix}
            className="rounded-md border border-zinc-200 px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-50"
          >
            Add my name
          </button>
        </div>
      </div>

      <textarea
        value={content}
        onChange={(event) => {
          editVersion.current += 1;
          setContent(event.target.value);
          setSaveStatus("pending");
        }}
        rows={16}
        placeholder={`Start typing, or click "Add my name" to write as ${currentUserLabel}...`}
        aria-describedby="local-save-status sync-status"
        className="w-full resize-y rounded-md border border-zinc-300 bg-white px-3 py-3 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/20"
      />
      <p className="text-xs text-zinc-400">
        Press Ctrl/Cmd + S to save immediately. Use “Add my name” for
        chat-style notes like “{currentUserLabel}: hello”.
      </p>
    </div>
  );
}
