import type { AiAction } from "@/lib/validations/ai";

type GenerateSuggestionInput = {
  action: AiAction;
  title: string;
  content: string;
};

type GeminiGenerateContentResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
};

type GenerateSuggestionResult = {
  suggestion: string;
  provider: "gemini" | "local";
};

const MAX_AI_INPUT_LENGTH = 6_000;
const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";

export async function generateDocumentSuggestion({
  action,
  title,
  content,
}: GenerateSuggestionInput): Promise<GenerateSuggestionResult> {
  const trimmedContent = content.trim();

  if (!trimmedContent) {
    return {
      suggestion: "This document is empty, so there is nothing to process yet.",
      provider: "local",
    };
  }

  const input = trimmedContent.slice(0, MAX_AI_INPUT_LENGTH);

  if (!process.env.GEMINI_API_KEY) {
    return {
      suggestion: generateLocalSuggestion(action, input),
      provider: "local",
    };
  }

  try {
    const model = process.env.GEMINI_MODEL ?? DEFAULT_GEMINI_MODEL;
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": process.env.GEMINI_API_KEY,
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: buildPrompt(action, title, input),
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.3,
          },
        }),
      },
    );

    if (!response.ok) {
      throw new Error(`AI provider request failed with ${response.status}`);
    }

    const body = (await response.json()) as GeminiGenerateContentResponse;
    const suggestion = body.candidates?.[0]?.content?.parts
      ?.map((part) => part.text)
      .filter(Boolean)
      .join("\n")
      .trim();

    if (!suggestion) {
      throw new Error("AI provider returned an empty response");
    }

    return {
      suggestion,
      provider: "gemini",
    };
  } catch (error) {
    console.warn("Falling back to local AI suggestion", error);
    return {
      suggestion: generateLocalSuggestion(action, input),
      provider: "local",
    };
  }
}

function buildPrompt(action: AiAction, title: string, content: string) {
  if (action === "summarize") {
    return `Summarize the document titled "${title}" in 3 concise bullet points.\n\nDocument:\n${content}`;
  }

  if (action === "improve") {
    return `Improve clarity, grammar, and flow while preserving the meaning of this document titled "${title}".\n\nDocument:\n${content}`;
  }

  return `Rewrite this document titled "${title}" in a clearer, more polished tone while preserving the original meaning.\n\nDocument:\n${content}`;
}

function generateLocalSuggestion(action: AiAction, content: string) {
  if (action === "summarize") {
    const sentences = content
      .split(/(?<=[.!?])\s+/)
      .map((sentence) => sentence.trim())
      .filter(Boolean)
      .slice(0, 3);

    if (sentences.length === 0) {
      return `- ${content.slice(0, 240)}`;
    }

    return sentences.map((sentence) => `- ${sentence}`).join("\n");
  }

  const normalized = content
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (action === "improve") {
    return `Local draft cleanup:\n\n${normalized}\n\nSet GEMINI_API_KEY to enable full AI-powered improvements.`;
  }

  return `Local rewrite draft:\n\n${normalized}\n\nSet GEMINI_API_KEY to enable full AI-powered rewriting.`;
}
