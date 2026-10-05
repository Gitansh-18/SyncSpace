"use client";

import { useState } from "react";
import type { AiAction } from "@/lib/validations/ai";

type AiAssistantProps = {
  documentId: string;
  canEdit: boolean;
};

type AiResponse = {
  action: AiAction;
  suggestion: string;
  provider: "gemini" | "local";
};

type AiOption = {
  action: AiAction;
  label: string;
  description: string;
  requiresEdit: boolean;
};

const AI_OPTIONS: AiOption[] = [
  {
    action: "summarize",
    label: "Summarize",
    description: "Create a short bullet summary of the latest server copy.",
    requiresEdit: false,
  },
  {
    action: "improve",
    label: "Improve writing",
    description: "Clean up grammar, clarity, and flow.",
    requiresEdit: true,
  },
  {
    action: "rewrite",
    label: "Rewrite",
    description: "Draft a more polished version with the same meaning.",
    requiresEdit: true,
  },
];

export function AiAssistant({ documentId, canEdit }: AiAssistantProps) {
  const [loadingAction, setLoadingAction] = useState<AiAction | null>(null);
  const [result, setResult] = useState<AiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runAssistant(action: AiAction) {
    setLoadingAction(action);
    setError(null);

    try {
      const response = await fetch(`/api/documents/${documentId}/ai`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action }),
      });
      const body = (await response.json()) as Partial<AiResponse> & {
        error?: string;
      };

      if (!response.ok || !body.suggestion || !body.action || !body.provider) {
        throw new Error(body.error ?? "Could not generate an AI suggestion.");
      }

      setResult({
        action: body.action,
        suggestion: body.suggestion,
        provider: body.provider,
      });
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not generate an AI suggestion.",
      );
    } finally {
      setLoadingAction(null);
    }
  }

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-6">
      <h2 className="text-sm font-medium text-zinc-900">AI assistant</h2>
      <p className="mt-1 text-xs text-zinc-500">
        Suggestions use the latest synced server content. Copy anything useful
        into the editor when you are ready.
      </p>

      <div className="mt-4 space-y-3">
        {AI_OPTIONS.map((option) => {
          const disabled = loadingAction !== null || (option.requiresEdit && !canEdit);

          return (
            <button
              key={option.action}
              type="button"
              onClick={() => runAssistant(option.action)}
              disabled={disabled}
              className="w-full rounded-md border border-zinc-200 px-3 py-2 text-left text-sm transition hover:border-zinc-300 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span className="font-medium text-zinc-900">
                {loadingAction === option.action ? "Generating…" : option.label}
              </span>
              <span className="mt-1 block text-xs text-zinc-500">
                {option.requiresEdit && !canEdit
                  ? "Only owners and editors can use this action."
                  : option.description}
              </span>
            </button>
          );
        })}
      </div>

      {error ? (
        <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {result ? (
        <div className="mt-4 rounded-md border border-zinc-200 bg-zinc-50 p-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              {result.action}
            </p>
            <span className="rounded-full bg-white px-2 py-0.5 text-xs text-zinc-500">
              {result.provider === "gemini" ? "Gemini" : "Local fallback"}
            </span>
          </div>
          <pre className="mt-3 whitespace-pre-wrap font-sans text-sm leading-6 text-zinc-800">
            {result.suggestion}
          </pre>
        </div>
      ) : null}
    </section>
  );
}
