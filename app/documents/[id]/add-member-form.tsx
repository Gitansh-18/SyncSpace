"use client";

import { DocumentRole } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useActionState } from "react";
import { addMemberAction, type AddMemberState } from "./actions";

const initialState: AddMemberState = {};

type AddMemberFormProps = {
  documentId: string;
};

export function AddMemberForm({ documentId }: AddMemberFormProps) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(addMemberAction, initialState);

  useEffect(() => {
    if (state.success) {
      router.refresh();
    }
  }, [state.success, router]);

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="documentId" value={documentId} />

      <div>
        <label htmlFor="email" className="block text-sm font-medium text-zinc-900">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          placeholder="collaborator@example.com"
          className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/20"
        />
      </div>

      <div>
        <label htmlFor="role" className="block text-sm font-medium text-zinc-900">
          Role
        </label>
        <select
          id="role"
          name="role"
          defaultValue={DocumentRole.EDITOR}
          className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/20"
        >
          <option value={DocumentRole.EDITOR}>Editor</option>
          <option value={DocumentRole.VIEWER}>Viewer</option>
        </select>
      </div>

      {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      {state.success ? <p className="text-sm text-green-700">{state.success}</p> : null}

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-60"
      >
        {pending ? "Adding..." : "Add member"}
      </button>
    </form>
  );
}
