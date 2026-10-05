import Link from "next/link";
import { auth, signOut } from "@/auth";

async function SignOutButton() {
  return (
    <form
      action={async () => {
        "use server";
        await signOut({ redirectTo: "/" });
      }}
    >
      <button
        type="submit"
        className="rounded-full px-3 py-1.5 text-sm text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-950"
      >
        Sign out
      </button>
    </form>
  );
}

export async function AuthNav() {
  const session = await auth();

  if (!session?.user) {
    return (
      <nav className="flex items-center gap-3">
        <Link
          href="/login"
          className="rounded-full px-3 py-1.5 text-sm text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-950"
        >
          Log in
        </Link>
        <Link
          href="/register"
          className="rounded-full bg-zinc-950 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-zinc-800 hover:shadow-md"
        >
          Sign up
        </Link>
      </nav>
    );
  }

  return (
    <nav className="flex items-center gap-3">
      <span className="hidden text-sm text-zinc-600 sm:inline">
        {session.user.email}
      </span>
      <Link
        href="/dashboard"
        className="rounded-full px-3 py-1.5 text-sm text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-950"
      >
        Dashboard
      </Link>
      <SignOutButton />
    </nav>
  );
}
