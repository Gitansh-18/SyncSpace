export function Footer() {
  return (
    <footer className="mt-auto border-t border-zinc-200/70 bg-white/60">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-7 text-sm text-zinc-500 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p>Built by Akash Gaur · Local-first collaboration</p>
        <div className="flex gap-4">
          <a
            href="https://github.com/Gaur2526"
            target="_blank"
            rel="noopener noreferrer"
            className="transition hover:text-zinc-950"
          >
            GitHub
          </a>
          <a
            href="https://www.linkedin.com/in/akash-gaur-295936227/"
            target="_blank"
            rel="noopener noreferrer"
            className="transition hover:text-zinc-950"
          >
            LinkedIn
          </a>
        </div>
      </div>
    </footer>
  );
}
