-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "initialContent" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "revision" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "DocumentOperation" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "baseRevision" INTEGER NOT NULL,
    "revision" INTEGER NOT NULL,
    "start" INTEGER NOT NULL,
    "deleteCount" INTEGER NOT NULL,
    "insertText" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "conflicted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentOperation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DocumentOperation_documentId_revision_idx" ON "DocumentOperation"("documentId", "revision");

-- CreateIndex
CREATE INDEX "DocumentOperation_userId_idx" ON "DocumentOperation"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentOperation_documentId_revision_key" ON "DocumentOperation"("documentId", "revision");

-- AddForeignKey
ALTER TABLE "DocumentOperation" ADD CONSTRAINT "DocumentOperation_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentOperation" ADD CONSTRAINT "DocumentOperation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
