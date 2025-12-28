-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "Service" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "url" TEXT NOT NULL,
    "version" TEXT NOT NULL DEFAULT 'v0.1',
    "owner" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Service_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "McpServer" (
    "id" TEXT NOT NULL,
    "serverId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "version" TEXT NOT NULL DEFAULT 'v0.1',
    "command" TEXT,
    "args" TEXT,
    "env" TEXT,
    "manifest" TEXT,
    "capabilities" TEXT,
    "tools" TEXT,
    "toolSchemas" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "federationId" TEXT,
    "publishedBy" TEXT,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" TEXT,
    "authConfig" TEXT,
    "encryptedTokens" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "workflowState" TEXT,
    "lockedBy" TEXT,
    "workflowAttempts" INTEGER NOT NULL DEFAULT 0,
    "contextId" TEXT,
    "workflowUpdatedAt" TIMESTAMP(3),
    "identityPublicKey" TEXT,
    "identitySignature" TEXT,
    "identityVerified" BOOLEAN NOT NULL DEFAULT false,
    "identityVerifiedAt" TIMESTAMP(3),
    "identityUrl" TEXT,
    "securityScore" INTEGER,
    "lastSecurityScan" TIMESTAMP(3),
    "securityScanResults" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "McpServer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DesignJob" (
    "id" TEXT NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'PENDING',
    "description" TEXT NOT NULL,
    "refinementNotes" TEXT,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "progressMessage" TEXT,
    "errorMessage" TEXT,
    "serverId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "DesignJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DurableTask" (
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

-- CreateTable
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "assetType" TEXT NOT NULL,
    "content" TEXT,
    "filePath" TEXT,
    "url" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isLatest" BOOLEAN NOT NULL DEFAULT true,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Federation" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "organizationId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Federation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OAuthClient" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "clientSecret" TEXT NOT NULL,
    "clientName" TEXT NOT NULL,
    "redirectUris" TEXT NOT NULL,
    "scopes" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OAuthClient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OAuthConsent" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "scopes" TEXT NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "OAuthConsent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "title" TEXT,
    "systemPrompt" TEXT,
    "context" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "toolCalls" TEXT,
    "toolResults" TEXT,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ToolInvocation" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT,
    "serverId" TEXT NOT NULL,
    "toolName" TEXT NOT NULL,
    "arguments" TEXT NOT NULL,
    "result" TEXT,
    "error" TEXT,
    "latency" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ToolInvocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Memory" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT,
    "userId" TEXT,
    "type" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "importance" INTEGER NOT NULL DEFAULT 1,
    "accessCount" INTEGER NOT NULL DEFAULT 0,
    "lastAccessed" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Memory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Service_name_key" ON "Service"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Service_url_key" ON "Service"("url");

-- CreateIndex
CREATE UNIQUE INDEX "McpServer_serverId_key" ON "McpServer"("serverId");

-- CreateIndex
CREATE INDEX "McpServer_serverId_idx" ON "McpServer"("serverId");

-- CreateIndex
CREATE INDEX "McpServer_isActive_idx" ON "McpServer"("isActive");

-- CreateIndex
CREATE INDEX "McpServer_isPublic_idx" ON "McpServer"("isPublic");

-- CreateIndex
CREATE INDEX "McpServer_federationId_idx" ON "McpServer"("federationId");

-- CreateIndex
CREATE INDEX "McpServer_publishedBy_idx" ON "McpServer"("publishedBy");

-- CreateIndex
CREATE INDEX "DesignJob_status_idx" ON "DesignJob"("status");

-- CreateIndex
CREATE INDEX "DesignJob_createdAt_idx" ON "DesignJob"("createdAt");

-- CreateIndex
CREATE INDEX "DesignJob_serverId_idx" ON "DesignJob"("serverId");

-- CreateIndex
CREATE UNIQUE INDEX "DurableTask_taskId_key" ON "DurableTask"("taskId");

-- CreateIndex
CREATE INDEX "DurableTask_serverId_idx" ON "DurableTask"("serverId");

-- CreateIndex
CREATE INDEX "DurableTask_status_idx" ON "DurableTask"("status");

-- CreateIndex
CREATE INDEX "DurableTask_taskId_idx" ON "DurableTask"("taskId");

-- CreateIndex
CREATE INDEX "DurableTask_createdAt_idx" ON "DurableTask"("createdAt");

-- CreateIndex
CREATE INDEX "Asset_jobId_idx" ON "Asset"("jobId");

-- CreateIndex
CREATE INDEX "Asset_isLatest_idx" ON "Asset"("isLatest");

-- CreateIndex
CREATE UNIQUE INDEX "Federation_name_key" ON "Federation"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Federation_organizationId_key" ON "Federation"("organizationId");

-- CreateIndex
CREATE INDEX "Federation_organizationId_idx" ON "Federation"("organizationId");

-- CreateIndex
CREATE INDEX "Federation_isActive_idx" ON "Federation"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "OAuthClient_clientId_key" ON "OAuthClient"("clientId");

-- CreateIndex
CREATE INDEX "OAuthClient_clientId_idx" ON "OAuthClient"("clientId");

-- CreateIndex
CREATE INDEX "OAuthClient_isActive_idx" ON "OAuthClient"("isActive");

-- CreateIndex
CREATE INDEX "OAuthConsent_userId_idx" ON "OAuthConsent"("userId");

-- CreateIndex
CREATE INDEX "OAuthConsent_clientId_idx" ON "OAuthConsent"("clientId");

-- CreateIndex
CREATE INDEX "OAuthConsent_isActive_idx" ON "OAuthConsent"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "OAuthConsent_clientId_userId_key" ON "OAuthConsent"("clientId", "userId");

-- CreateIndex
CREATE INDEX "Conversation_userId_idx" ON "Conversation"("userId");

-- CreateIndex
CREATE INDEX "Conversation_createdAt_idx" ON "Conversation"("createdAt");

-- CreateIndex
CREATE INDEX "Message_conversationId_idx" ON "Message"("conversationId");

-- CreateIndex
CREATE INDEX "Message_createdAt_idx" ON "Message"("createdAt");

-- CreateIndex
CREATE INDEX "ToolInvocation_conversationId_idx" ON "ToolInvocation"("conversationId");

-- CreateIndex
CREATE INDEX "ToolInvocation_serverId_idx" ON "ToolInvocation"("serverId");

-- CreateIndex
CREATE INDEX "ToolInvocation_createdAt_idx" ON "ToolInvocation"("createdAt");

-- CreateIndex
CREATE INDEX "Memory_conversationId_idx" ON "Memory"("conversationId");

-- CreateIndex
CREATE INDEX "Memory_userId_idx" ON "Memory"("userId");

-- CreateIndex
CREATE INDEX "Memory_type_idx" ON "Memory"("type");

-- CreateIndex
CREATE INDEX "Memory_key_idx" ON "Memory"("key");

-- CreateIndex
CREATE INDEX "Memory_importance_idx" ON "Memory"("importance");

-- AddForeignKey
ALTER TABLE "McpServer" ADD CONSTRAINT "McpServer_federationId_fkey" FOREIGN KEY ("federationId") REFERENCES "Federation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DesignJob" ADD CONSTRAINT "DesignJob_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "McpServer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DurableTask" ADD CONSTRAINT "DurableTask_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "McpServer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "DesignJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OAuthConsent" ADD CONSTRAINT "OAuthConsent_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "OAuthClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ToolInvocation" ADD CONSTRAINT "ToolInvocation_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Memory" ADD CONSTRAINT "Memory_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
