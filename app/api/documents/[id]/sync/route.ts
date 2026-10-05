import { auth } from "@/auth";
import {
  syncRequestSchema,
  MAX_SYNC_PAYLOAD_BYTES,
} from "@/lib/validations/sync";
import { syncDocument, SyncServerError } from "@/lib/sync/server";
import { documentIdSchema } from "@/lib/validations/document";

type SyncRouteContext = {
  params: Promise<{ id: string }>;
};

class PayloadTooLargeError extends Error {}

export async function POST(request: Request, context: SyncRouteContext) {
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

  const declaredLength = Number(request.headers.get("content-length"));

  if (
    Number.isFinite(declaredLength) &&
    declaredLength > MAX_SYNC_PAYLOAD_BYTES
  ) {
    return Response.json(
      { error: "Sync payload is too large" },
      { status: 413 },
    );
  }

  const session = await auth();

  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;

  try {
    body = await readLimitedJson(request);
  } catch (error) {
    if (error instanceof PayloadTooLargeError) {
      return Response.json(
        { error: "Sync payload is too large" },
        { status: 413 },
      );
    }

    return Response.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const parsed = syncRequestSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json({ error: "Invalid sync payload" }, { status: 400 });
  }

  try {
    const result = await syncDocument({
      documentId: parsedDocumentId.data,
      userId: session.user.id,
      ...parsed.data,
    });

    return Response.json(result, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof SyncServerError) {
      return Response.json(
        { error: error.message },
        { status: error.status },
      );
    }

    console.error("Document sync failed", error);
    return Response.json(
      { error: "Synchronization failed" },
      { status: 500 },
    );
  }
}

async function readLimitedJson(request: Request) {
  if (!request.body) {
    throw new Error("Request body is missing");
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    totalBytes += value.byteLength;

    if (totalBytes > MAX_SYNC_PAYLOAD_BYTES) {
      await reader.cancel();
      throw new PayloadTooLargeError();
    }

    chunks.push(value);
  }

  const body = new Uint8Array(totalBytes);
  let offset = 0;

  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(body));
}
