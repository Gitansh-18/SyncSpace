"use client";

import { DocumentRole } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useActionState } from "react";
import {
  updateMemberRoleStateAction,
  type UpdateMemberRoleState,
} from "./actions";

type MemberRoleFormProps = {
  documentId: string;
  memberId: string;
  currentRole: DocumentRole;
};

const initialState: UpdateMemberRoleState = {};

export function MemberRoleForm({
  documentId,
  memberId,
  currentRole,
}: MemberRoleFormProps) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    updateMemberRoleStateAction,
    initialState,
  );

  useEffect(() => {
    if (state.success) {
      router.refresh();
    }
  }, [state.success, router]);

  return (
    <form action={formAction} className="space-y-2">
      <div className="flex items-center gap-2">
        <input type="hidden" name="documentId" value={documentId} />
        <input type="hidden" name="memberId" value={memberId} />
        <select
          key={currentRole}
          name="role"
          defaultValue={currentRole}
          disabled={pending}
          className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-900 outline-none focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/20 disabled:opacity-60"
        >
          <option value={DocumentRole.EDITOR}>Editor</option>
          <option value={DocumentRole.VIEWER}>Viewer</option>
        </select>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-60"
        >
          {pending ? "Saving..." : "Save"}
        </button>
      </div>

      {state.error ? <p className="text-xs text-red-600">{state.error}</p> : null}
      {state.success ? (
        <p className="text-xs text-green-700">{state.success}</p>
      ) : null}
    </form>
  );
}
