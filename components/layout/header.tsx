import Link from "next/link";
import { AuthNav } from "@/components/auth/auth-nav";

export function Header() {
  return (
    <header className="sticky top-0 z-20 border-b border-white/70 bg-white/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link
          href="/"
          className="flex items-center gap-2 text-sm font-semibold tracking-tight text-zinc-950"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-zinc-950 text-xs font-bold text-white shadow-sm">
            CE
          </span>
          <span>Collab Editor</span>
        </Link>
        <AuthNav />
      </div>
    </header>
  );
}
