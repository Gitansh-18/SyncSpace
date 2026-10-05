import Link from "next/link";
import { requireUser } from "@/lib/auth/require-user";
import { formatRole } from "@/lib/documents/permissions";
import { getDocumentsForUser } from "@/lib/documents/queries";
import { CreateDocumentForm } from "./create-document-form";

export default async function DashboardPage() {
  const user = await requireUser();
  const documents = await getDocumentsForUser(user.id);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-10 sm:px-6">
      <div className="rounded-3xl border border-white/70 bg-[linear-gradient(135deg,#18181b,#3f3f46)] p-6 text-white shadow-xl shadow-zinc-950/10 sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-medium text-zinc-300">Workspace</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
              Welcome back, {user.name ?? user.email}.
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-300">
              Create documents, collaborate with your team, and keep writing
              through spotty connections.
            </p>
          </div>
          <div className="rounded-2xl bg-white/10 px-4 py-3 text-sm text-zinc-200 ring-1 ring-white/15">
            {documents.length} {documents.length === 1 ? "document" : "documents"}
          </div>
        </div>
      </div>

      <div className="mt-6">
        <CreateDocumentForm />
      </div>

      <section className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-zinc-950">Your documents</h2>
          <p className="text-sm text-zinc-500">Sorted by recent activity</p>
        </div>

        {documents.length === 0 ? (
          <div className="mt-4 rounded-3xl border border-dashed border-zinc-300 bg-white p-10 text-center shadow-sm">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-500">
              ✦
            </div>
            <h3 className="mt-4 font-medium text-zinc-950">
              No documents yet
            </h3>
            <p className="mt-2 text-sm text-zinc-600">
              Create your first shared document to start testing collaboration.
            </p>
          </div>
        ) : (
          <ul className="mt-4 grid gap-4 md:grid-cols-2">
            {documents.map((document) => (
              <li key={document.id}>
                <Link
                  href={`/documents/${document.id}`}
                  className="group block rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-medium text-zinc-950 group-hover:text-zinc-700">
                        {document.title}
                      </p>
                      <p className="mt-2 text-xs text-zinc-500">
                        Updated {document.updatedAt.toLocaleDateString()}
                      </p>
                    </div>
                    <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-700">
                      {formatRole(document.role)}
                    </span>
                  </div>
                  <p className="mt-5 text-sm text-zinc-500">
                    Open document →
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
