"use client";

import { useActionState } from "react";
import { acceptInvitationAction, type AcceptInvitationState } from "./actions";

const initialState: AcceptInvitationState = {};

type AcceptInvitationFormProps = {
  token: string;
};

export function AcceptInvitationForm({ token }: AcceptInvitationFormProps) {
  const [state, formAction, pending] = useActionState(
    acceptInvitationAction,
    initialState,
  );

  return (
    <form action={formAction} className="mt-6 space-y-4">
      <input type="hidden" name="token" value={token} />

      {state.error ? (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-60"
      >
        {pending ? "Accepting..." : "Accept invitation"}
      </button>
    </form>
  );
}