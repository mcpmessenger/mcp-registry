-- AlterEnum
ALTER TYPE "JobStatus" ADD VALUE 'CANCELLED';

-- CreateTable
CREATE TABLE "OrchestratorJob" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "sessionId" TEXT,
    "status" "JobStatus" NOT NULL DEFAULT 'PENDING',
    "resultJson" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "OrchestratorJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OrchestratorJob_requestId_key" ON "OrchestratorJob"("requestId");

-- CreateIndex
CREATE INDEX "OrchestratorJob_requestId_idx" ON "OrchestratorJob"("requestId");

-- CreateIndex
CREATE INDEX "OrchestratorJob_status_idx" ON "OrchestratorJob"("status");

-- CreateIndex
CREATE INDEX "OrchestratorJob_createdAt_idx" ON "OrchestratorJob"("createdAt");

-- CreateIndex
CREATE INDEX "OrchestratorJob_sessionId_idx" ON "OrchestratorJob"("sessionId");

