"use client";

import { useActionState } from "react";
import { createDocumentAction, type CreateDocumentState } from "./actions";

const initialState: CreateDocumentState = {};

export function CreateDocumentForm() {
  const [state, formAction, pending] = useActionState(
    createDocumentAction,
    initialState,
  );

  return (
    <form
      action={formAction}
      className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm"
    >
      <label htmlFor="title" className="block text-sm font-medium text-zinc-950">
        Create a new document
      </label>
      <div className="mt-3 flex flex-col gap-3 sm:flex-row">
        <input
          id="title"
          name="title"
          type="text"
          placeholder="Weekly planning, product brief, meeting notes..."
          required
          className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-xl bg-zinc-950 px-5 py-3 text-sm font-medium text-white shadow-sm transition hover:bg-zinc-800 disabled:opacity-60 sm:shrink-0"
        >
          {pending ? "Creating..." : "Create"}
        </button>
      </div>
      {state.error ? (
        <p className="mt-2 text-sm text-red-600">{state.error}</p>
      ) : null}
    </form>
  );
}
