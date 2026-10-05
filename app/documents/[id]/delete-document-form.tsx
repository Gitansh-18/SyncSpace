"use client";

import { useActionState } from "react";
import {
  deleteDocumentStateAction,
  type DeleteDocumentState,
} from "./actions";

type DeleteDocumentFormProps = {
  documentId: string;
};

const initialState: DeleteDocumentState = {};

export function DeleteDocumentForm({ documentId }: DeleteDocumentFormProps) {
  const [state, formAction, pending] = useActionState(
    deleteDocumentStateAction,
    initialState,
  );

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="documentId" value={documentId} />
      <button
        type="submit"
        disabled={pending}
        onClick={(event) => {
          if (!window.confirm("Delete this document permanently?")) {
            event.preventDefault();
          }
        }}
        className="rounded-md border border-red-200 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Deleting..." : "Delete document"}
      </button>
      {state.error ? <p className="text-xs text-red-600">{state.error}</p> : null}
    </form>
  );
}
