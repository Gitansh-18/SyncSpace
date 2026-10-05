import { auth } from "@/auth";
import { generateDocumentSuggestion } from "@/lib/ai/provider";
import { canEditDocument } from "@/lib/documents/permissions";
import { getDocumentMembership } from "@/lib/documents/queries";
import { aiRequestSchema } from "@/lib/validations/ai";
import { documentIdSchema } from "@/lib/validations/document";

type AiRouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: AiRouteContext) {
  const session = await auth();

  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const parsedDocumentId = documentIdSchema.safeParse(id);

  if (!parsedDocumentId.success) {
    return Response.json({ error: "Invalid document id" }, { status: 400 });
  }

  const contentType = request.headers.get("content-type");

  if (!contentType?.toLowerCase().includes("application/json")) {
    return Response.json(
      { error: "Content-Type must be application/json" },
      { status: 415 },
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const parsed = aiRequestSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json({ error: "Invalid AI request" }, { status: 400 });
  }

  const membership = await getDocumentMembership(
    session.user.id,
    parsedDocumentId.data,
  );

  if (!membership) {
    return Response.json({ error: "Document not found" }, { status: 404 });
  }

  if (
    parsed.data.action !== "summarize" &&
    !canEditDocument(membership.role)
  ) {
    return Response.json(
      { error: "Only owners and editors can rewrite document content" },
      { status: 403 },
    );
  }

  try {
    const result = await generateDocumentSuggestion({
      action: parsed.data.action,
      title: membership.document.title,
      content: membership.document.content,
    });

    return Response.json(
      {
        action: parsed.data.action,
        suggestion: result.suggestion,
        provider: result.provider,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    console.error("AI suggestion failed", error);
    return Response.json(
      { error: "AI suggestion failed. Please try again." },
      { status: 502 },
    );
  }
}
