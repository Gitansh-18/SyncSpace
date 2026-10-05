import { db } from "@/lib/db";

export async function getDocumentsForUser(userId: string) {
  const memberships = await db.documentMember.findMany({
    where: { userId },
    include: {
      document: {
        select: {
          id: true,
          title: true,
          updatedAt: true,
        },
      },
    },
    orderBy: {
      document: {
        updatedAt: "desc",
      },
    },
  });

  return memberships.map((membership) => ({
    id: membership.document.id,
    title: membership.document.title,
    role: membership.role,
    updatedAt: membership.document.updatedAt,
  }));
}

export async function getDocumentMembership(userId: string, documentId: string) {
  return db.documentMember.findUnique({
    where: {
      documentId_userId: {
        documentId,
        userId,
      },
    },
    include: {
      document: {
        include: {
          members: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
            orderBy: {
              createdAt: "asc",
            },
          },
        },
      },
    },
  });
}

export async function getDocumentVersions(userId: string, documentId: string) {
  const membership = await db.documentMember.findUnique({
    where: {
      documentId_userId: {
        documentId,
        userId,
      },
    },
    select: {
      document: {
        select: {
          id: true,
          initialContent: true,
          revision: true,
          createdAt: true,
          operations: {
            orderBy: {
              revision: "desc",
            },
            take: 20,
            select: {
              id: true,
              revision: true,
              content: true,
              conflicted: true,
              createdAt: true,
              user: {
                select: {
                  name: true,
                  email: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!membership) {
    return [];
  }

  const { document } = membership;

  return [
    ...document.operations.map((operation) => ({
      id: operation.id,
      revision: operation.revision,
      createdAt: operation.createdAt,
      author: operation.user.name ?? operation.user.email,
      contentLength: operation.content.length,
      conflicted: operation.conflicted,
      isCurrent: operation.revision === document.revision,
    })),
    {
      id: `${document.id}:initial`,
      revision: 0,
      createdAt: document.createdAt,
      author: "Initial document",
      contentLength: document.initialContent.length,
      conflicted: false,
      isCurrent: document.revision === 0,
    },
  ];
}
