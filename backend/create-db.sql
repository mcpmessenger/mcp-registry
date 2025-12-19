-- Create tables manually for SQLite
CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
    "id" TEXT PRIMARY KEY NOT NULL,
    "checksum" TEXT NOT NULL,
    "finished_at" DATETIME,
    "migration_name" TEXT NOT NULL,
    "logs" TEXT,
    "rolled_back_at" DATETIME,
    "started_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "applied_steps_count" INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS "Service" (
    "id" TEXT PRIMARY KEY NOT NULL,
    "name" TEXT NOT NULL UNIQUE,
    "description" TEXT,
    "url" TEXT NOT NULL UNIQUE,
    "version" TEXT NOT NULL DEFAULT 'v0.1',
    "owner" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS "McpServer" (
    "id" TEXT PRIMARY KEY NOT NULL,
    "serverId" TEXT NOT NULL UNIQUE,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "version" TEXT NOT NULL DEFAULT 'v0.1',
    "command" TEXT,
    "args" TEXT,
    "env" TEXT,
    "manifest" TEXT,
    "capabilities" TEXT,
    "tools" TEXT,
    "isActive" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE INDEX IF NOT EXISTS "McpServer_serverId_idx" ON "McpServer"("serverId");
CREATE INDEX IF NOT EXISTS "McpServer_isActive_idx" ON "McpServer"("isActive");

CREATE TABLE IF NOT EXISTS "DesignJob" (
    "id" TEXT PRIMARY KEY NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "description" TEXT NOT NULL,
    "refinementNotes" TEXT,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "progressMessage" TEXT,
    "errorMessage" TEXT,
    "serverId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "completedAt" DATETIME,
    FOREIGN KEY ("serverId") REFERENCES "McpServer"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "DesignJob_status_idx" ON "DesignJob"("status");
CREATE INDEX IF NOT EXISTS "DesignJob_createdAt_idx" ON "DesignJob"("createdAt");
CREATE INDEX IF NOT EXISTS "DesignJob_serverId_idx" ON "DesignJob"("serverId");

CREATE TABLE IF NOT EXISTS "Asset" (
    "id" TEXT PRIMARY KEY NOT NULL,
    "jobId" TEXT NOT NULL,
    "assetType" TEXT NOT NULL,
    "content" TEXT,
    "filePath" TEXT,
    "url" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isLatest" INTEGER NOT NULL DEFAULT 1,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("jobId") REFERENCES "DesignJob"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "Asset_jobId_idx" ON "Asset"("jobId");
CREATE INDEX IF NOT EXISTS "Asset_isLatest_idx" ON "Asset"("isLatest");
