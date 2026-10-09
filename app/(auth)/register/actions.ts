"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getSafeCallbackUrl } from "@/lib/auth/callback-url";
import { hashPassword } from "@/lib/password";
import { registerSchema } from "@/lib/validations/auth";

export type RegisterState = {
  error?: string;
};

export async function registerAction(
  _prevState: RegisterState,
  formData: FormData,
): Promise<RegisterState> {
  const parsed = registerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const callbackUrl = getSafeCallbackUrl(formData.get("callbackUrl"));

  const existingUser = await db.user.findUnique({
    where: { email: parsed.data.email },
  });

  if (existingUser) {
    return { error: "An account with this email already exists" };
  }

  const passwordHash = await hashPassword(parsed.data.password);

  await db.user.create({
    data: {
      name: parsed.data.name,
      email: parsed.data.email,
      passwordHash,
    },
  });

  const loginPath =
    callbackUrl && callbackUrl !== "/login"
      ? `/login?registered=1&callbackUrl=${encodeURIComponent(callbackUrl)}`
      : "/login?registered=1";

  redirect(loginPath);
}
