-- Check if DurableTask table exists, if not create it
CREATE TABLE IF NOT EXISTS "DurableTask" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "serverId" TEXT NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'PENDING',
    "taskType" TEXT,
    "description" TEXT,
    "input" TEXT,
    "output" TEXT,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "progressMessage" TEXT,
    "errorMessage" TEXT,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    CONSTRAINT "DurableTask_pkey" PRIMARY KEY ("id")
);

-- Add securityScore column to McpServer if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'McpServer' AND column_name = 'securityScore') THEN
        ALTER TABLE "McpServer" ADD COLUMN "securityScore" INTEGER;
    END IF;
END$$;
