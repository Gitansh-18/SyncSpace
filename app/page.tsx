export default function Home() {
  return (
    <div className="relative isolate flex flex-1 overflow-hidden">
      <div className="absolute inset-x-0 top-0 -z-10 h-80 bg-[radial-gradient(circle_at_top_left,#dbeafe,transparent_34%),radial-gradient(circle_at_top_right,#f5d0fe,transparent_30%)]" />
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-16 sm:px-6 lg:py-24">
        <section className="grid flex-1 items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            <div className="inline-flex rounded-full border border-zinc-200 bg-white/80 px-3 py-1 text-sm font-medium text-zinc-600 shadow-sm backdrop-blur">
              Secure collaborative writing
            </div>
            <h1 className="mt-6 max-w-3xl text-4xl font-semibold tracking-tight text-zinc-950 sm:text-6xl">
              Write together, even when the network disappears.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-zinc-600">
              Create shared documents, keep editing offline, sync changes in
              the background, and restore earlier versions with confidence.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a
                href="/dashboard"
                className="inline-flex items-center justify-center rounded-full bg-zinc-950 px-5 py-3 text-sm font-medium text-white shadow-lg shadow-zinc-950/10 transition hover:-translate-y-0.5 hover:bg-zinc-800"
              >
                Open dashboard
              </a>
              <a
                href="/register"
                className="inline-flex items-center justify-center rounded-full border border-zinc-200 bg-white px-5 py-3 text-sm font-medium text-zinc-900 shadow-sm transition hover:-translate-y-0.5 hover:border-zinc-300"
              >
                Create account
              </a>
            </div>
          </div>

          <div className="rounded-3xl border border-white/70 bg-white/80 p-4 shadow-2xl shadow-zinc-950/10 backdrop-blur">
            <div className="rounded-2xl border border-zinc-200 bg-zinc-950 p-5 text-white">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-zinc-300">Project notes</p>
                <span className="rounded-full bg-emerald-400/15 px-2.5 py-1 text-xs font-medium text-emerald-200">
                  Synced
                </span>
              </div>
              <div className="mt-6 space-y-3 rounded-xl bg-white p-4 text-sm text-zinc-700">
                <p className="h-3 w-4/5 rounded-full bg-zinc-200" />
                <p className="h-3 w-full rounded-full bg-zinc-200" />
                <p className="h-3 w-2/3 rounded-full bg-zinc-200" />
                <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-3 text-xs text-zinc-500">
                  Offline edits are saved locally and replayed when the
                  connection returns.
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-16 grid gap-4 md:grid-cols-3">
          {[
            ["Offline-first", "IndexedDB keeps edits safe before sync."],
            ["Role-based sharing", "Owners invite editors and read-only viewers."],
            ["Version history", "Restore earlier revisions without losing context."],
          ].map(([title, description]) => (
            <div
              key={title}
              className="rounded-2xl border border-zinc-200 bg-white/80 p-5 shadow-sm"
            >
              <h2 className="font-medium text-zinc-950">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-zinc-600">
                {description}
              </p>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}
