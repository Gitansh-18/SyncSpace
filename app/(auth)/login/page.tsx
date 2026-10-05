import Link from "next/link";
import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ registered?: string }>;
}) {
  const params = await searchParams;

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-8 shadow-sm">
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
        Log in
      </h1>
      <p className="mt-2 text-sm text-zinc-600">
        Access your documents and continue editing offline.
      </p>

      {params.registered ? (
        <p className="mt-4 rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">
          Account created. You can log in now.
        </p>
      ) : null}

      <LoginForm />

      <p className="mt-6 text-center text-sm text-zinc-600">
        No account yet?{" "}
        <Link href="/register" className="font-medium text-zinc-900 hover:underline">
          Sign up
        </Link>
      </p>
    </div>
  );
}
