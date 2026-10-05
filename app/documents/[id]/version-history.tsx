import type { DocumentRole } from "@prisma/client";
import { canEditDocument } from "@/lib/documents/permissions";
import { restoreVersionAction } from "./actions";

type VersionHistoryItem = {
  id: string;
  revision: number;
  createdAt: Date;
  author: string;
  contentLength: number;
  conflicted: boolean;
  isCurrent: boolean;
};

type VersionHistoryProps = {
  documentId: string;
  role: DocumentRole;
  versions: VersionHistoryItem[];
};

export function VersionHistory({
  documentId,
  role,
  versions,
}: VersionHistoryProps) {
  const canRestore = canEditDocument(role);

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-6">
      <h2 className="text-sm font-medium text-zinc-900">Version history</h2>
      <p className="mt-1 text-xs text-zinc-500">
        Each synced change creates a restorable snapshot.
      </p>

      <ol className="mt-4 space-y-4">
        {versions.map((version) => (
          <li
            key={version.id}
            className="rounded-md border border-zinc-100 bg-zinc-50 p-3"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-zinc-900">
                  Revision {version.revision}
                  {version.isCurrent ? (
                    <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                      Current
                    </span>
                  ) : null}
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  {version.createdAt.toLocaleString()} by {version.author}
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  {version.contentLength.toLocaleString()} characters
                  {version.conflicted ? " · conflict markers included" : ""}
                </p>
              </div>

              {canRestore && !version.isCurrent ? (
                <form action={restoreVersionAction}>
                  <input type="hidden" name="documentId" value={documentId} />
                  <input
                    type="hidden"
                    name="revision"
                    value={version.revision}
                  />
                  <button
                    type="submit"
                    className="rounded-md border border-zinc-200 px-2 py-1 text-xs text-zinc-700 hover:bg-white"
                  >
                    Restore
                  </button>
                </form>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
