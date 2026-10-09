import Link from "next/link";
import { RegisterForm } from "./register-form";

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const params = await searchParams;
  const loginHref = params.callbackUrl
    ? `/login?callbackUrl=${encodeURIComponent(params.callbackUrl)}`
    : "/login";

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-8 shadow-sm">
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
        Create an account
      </h1>
      <p className="mt-2 text-sm text-zinc-600">
        Sign up to create and collaborate on documents.
      </p>

      <RegisterForm callbackUrl={params.callbackUrl} />

      <p className="mt-6 text-center text-sm text-zinc-600">
        Already have an account?{" "}
        <Link href={loginHref} className="font-medium text-zinc-900 hover:underline">
          Log in
        </Link>
      </p>
    </div>
  );
}
