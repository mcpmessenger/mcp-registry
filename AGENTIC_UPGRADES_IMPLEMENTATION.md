# MCP Registry Agentic Upgrades - Implementation Guide

Complete implementation guide for memory, cross-server communication, and enhanced OAuth.

## 📋 Overview

This guide implements three major agentic upgrades:
1. **Memory System** - Persistent context storage for agents
2. **Cross-Server Pub/Sub** - Event-driven communication between MCP servers
3. **Enhanced OAuth** - Third-party server authentication with encrypted tokens

---

## 🧠 Part 1: Memory Implementation

### Architecture

```
┌─────────────────────────────────────────┐
│         Memory Service                  │
├─────────────────────────────────────────┤
│  - upsert_context()                    │
│  - search_history()                    │
│  - get_memories()                      │
│  - Memory Types:                        │
│    • preference                        │
│    • fact                              │
│    • context                           │
│    • instruction                       │
└─────────────────────────────────────────┘
```

### Step 1: Fix Prisma Schema (Remove Duplicates)

The schema has duplicate `Conversation`, `Message`, `ToolInvocation`, and `Memory` models. We'll keep the second set (lines 239-313) as they're more complete.

**File: `backend/prisma/schema.prisma`**

1. **Remove lines 162-237** (duplicate models)
2. **Keep models starting at line 239** (more complete versions)
3. **Add unique constraints to Memory model:**

```prisma
model Memory {
  // ... existing fields ...
  
  @@unique([conversationId, key])
  @@unique([userId, key])
  // ... existing indexes ...
}
```

**Run migration:**
```bash
cd backend
npm run migrate
```

### Step 2: Create Memory Service

**File: `backend/src/services/memory.service.ts`**

```typescript
import { prisma } from '../config/database'
import type { Prisma } from '@prisma/client'

export type MemoryType = 'preference' | 'fact' | 'context' | 'instruction'

export interface MemoryInput {
  conversationId?: string
  userId?: string
  type: MemoryType
  key: string
  value: any // Will be JSON stringified
  importance?: number // 1-10
  expiresAt?: Date
}

export interface ContextData {
  toolOutputs?: Record<string, any>
  conversationState?: Record<string, any>
  userPreferences?: Record<string, any>
  learnedFacts?: Record<string, any>
}

export class MemoryService {
  /**
   * Upsert context data for a conversation
   * Stores tool outputs, conversation state, and other context
   */
  async upsertContext(
    conversationId: string,
    context: ContextData
  ): Promise<void> {
    // Store tool outputs as context memories
    if (context.toolOutputs) {
      for (const [toolName, output] of Object.entries(context.toolOutputs)) {
        await prisma.memory.upsert({
          where: {
            conversationId_key: {
              conversationId,
              key: `tool_output:${toolName}`,
            },
          },
          update: {
            value: JSON.stringify(output),
            type: 'context',
            lastAccessed: new Date(),
            accessCount: { increment: 1 },
          },
          create: {
            conversationId,
            type: 'context',
            key: `tool_output:${toolName}`,
            value: JSON.stringify(output),
            importance: 5,
          },
        })
      }
    }

    // Store conversation state
    if (context.conversationState) {
      await prisma.memory.upsert({
        where: {
          conversationId_key: {
            conversationId,
            key: 'conversation_state',
          },
        },
        update: {
          value: JSON.stringify(context.conversationState),
          type: 'context',
          lastAccessed: new Date(),
        },
        create: {
          conversationId,
          type: 'context',
          key: 'conversation_state',
          value: JSON.stringify(context.conversationState),
          importance: 7,
        },
      })
    }

    // Store user preferences
    if (context.userPreferences) {
      for (const [key, value] of Object.entries(context.userPreferences)) {
        await prisma.memory.upsert({
          where: {
            userId_key: context.userPreferences.userId
              ? {
                  userId: context.userPreferences.userId,
                  key: `preference:${key}`,
                }
              : {
                  conversationId_key: {
                    conversationId,
                    key: `preference:${key}`,
                  },
                },
          },
          update: {
            value: JSON.stringify(value),
            type: 'preference',
            lastAccessed: new Date(),
          },
          create: {
            conversationId,
            userId: context.userPreferences.userId,
            type: 'preference',
            key: `preference:${key}`,
            value: JSON.stringify(value),
            importance: 8,
          },
        })
      }
    }

    // Store learned facts
    if (context.learnedFacts) {
      for (const [key, value] of Object.entries(context.learnedFacts)) {
        await prisma.memory.upsert({
          where: {
            conversationId_key: {
              conversationId,
              key: `fact:${key}`,
            },
          },
          update: {
            value: JSON.stringify(value),
            type: 'fact',
            lastAccessed: new Date(),
            accessCount: { increment: 1 },
          },
          create: {
            conversationId,
            type: 'fact',
            key: `fact:${key}`,
            value: JSON.stringify(value),
            importance: 6,
          },
        })
      }
    }
  }

  /**
   * Search conversation history
   * Returns relevant memories based on query
   */
  async searchHistory(
    conversationId: string,
    query: string,
    options?: {
      limit?: number
      types?: MemoryType[]
      minImportance?: number
    }
  ): Promise<Array<{ key: string; value: any; type: MemoryType; importance: number }>> {
    const where: Prisma.MemoryWhereInput = {
      conversationId,
      ...(options?.types && { type: { in: options.types } }),
      ...(options?.minImportance && { importance: { gte: options.minImportance } }),
      // Search in key or value (simple text search)
      OR: [
        { key: { contains: query, mode: 'insensitive' } },
        { value: { string_contains: query } },
      ],
    }

    const memories = await prisma.memory.findMany({
      where,
      orderBy: [
        { importance: 'desc' },
        { accessCount: 'desc' },
        { lastAccessed: 'desc' },
      ],
      take: options?.limit || 10,
    })

    return memories.map((m) => ({
      key: m.key,
      value: JSON.parse(m.value),
      type: m.type as MemoryType,
      importance: m.importance,
    }))
  }

  /**
   * Get memories for a conversation
   */
  async getMemories(
    conversationId: string,
    options?: {
      types?: MemoryType[]
      userId?: string
    }
  ): Promise<Array<{ key: string; value: any; type: MemoryType }>> {
    const where: Prisma.MemoryWhereInput = {
      OR: [
        { conversationId },
        ...(options?.userId ? [{ userId: options.userId }] : []),
      ],
      ...(options?.types && { type: { in: options.types } }),
    }

    const memories = await prisma.memory.findMany({
      where,
      orderBy: [{ importance: 'desc' }, { lastAccessed: 'desc' }],
    })

    return memories.map((m) => ({
      key: m.key,
      value: JSON.parse(m.value),
      type: m.type as MemoryType,
    }))
  }

  /**
   * Store a memory
   */
  async storeMemory(input: MemoryInput): Promise<void> {
    await prisma.memory.create({
      data: {
        conversationId: input.conversationId,
        userId: input.userId,
        type: input.type,
        key: input.key,
        value: JSON.stringify(input.value),
        importance: input.importance || 5,
        expiresAt: input.expiresAt,
      },
    })
  }

  /**
   * Update memory access (for prioritization)
   */
  async recordAccess(memoryId: string): Promise<void> {
    await prisma.memory.update({
      where: { id: memoryId },
      data: {
        accessCount: { increment: 1 },
        lastAccessed: new Date(),
      },
    })
  }
}

export const memoryService = new MemoryService()
```

### Step 3: Add search_history Tool to MCP Servers

**File: `backend/src/routes/v0/invoke.ts`**

Add a special handler for `search_history` tool that agents can call:

```typescript
// In the invoke route handler, before normal tool invocation:
if (validated.tool === 'search_history') {
  const { conversationId, query, options } = validated.arguments
  
  const memories = await memoryService.searchHistory(conversationId, query, options)
  
  return res.json({
    success: true,
    result: {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            memories,
            count: memories.length,
          }),
        },
      ],
    },
  })
}
```

---

## 🔔 Part 2: Cross-Server Pub/Sub Bus

### Architecture

```
┌─────────────────────────────────────────┐
│         Event Bus (Kafka)               │
├─────────────────────────────────────────┤
│  Topics:                                │
│  - mcp.events.{serverId}               │
│  - mcp.events.all                      │
│                                         │
│  Event Format:                          │
│  {                                      │
│    event: "vision.captured",           │
│    serverId: "com.playwright/mcp",     │
│    payload: {...},                     │
│    timestamp: "2024-..."               │
│  }                                      │
└─────────────────────────────────────────┘
```

### Step 1: Create Event Bus Service

**File: `backend/src/services/event-bus.service.ts`**

```typescript
import { kafkaProducer } from '../config/kafka'
import { env } from '../config/env'

export interface MCPEvent {
  event: string // e.g., "vision.captured", "data.processed"
  serverId: string
  payload: Record<string, any>
  timestamp: string
  conversationId?: string
  correlationId?: string
}

export class EventBusService {
  /**
   * Emit an event that other servers can subscribe to
   */
  async emit(event: Omit<MCPEvent, 'timestamp'>): Promise<void> {
    const mcpEvent: MCPEvent = {
      ...event,
      timestamp: new Date().toISOString(),
    }

    // Publish to server-specific topic
    const serverTopic = `mcp.events.${event.serverId.replace(/\//g, '.')}`
    await kafkaProducer.send({
      topic: serverTopic,
      messages: [
        {
          key: event.event,
          value: JSON.stringify(mcpEvent),
        },
      ],
    })

    // Also publish to global topic for cross-server subscriptions
    await kafkaProducer.send({
      topic: 'mcp.events.all',
      messages: [
        {
          key: `${event.serverId}:${event.event}`,
          value: JSON.stringify(mcpEvent),
        },
      ],
    })
  }

  /**
   * Subscribe to events from a specific server or event type
   */
  async subscribe(
    serverId: string,
    eventPattern: string, // e.g., "vision.*" or "*.captured"
    handler: (event: MCPEvent) => Promise<void>
  ): Promise<void> {
    // This would be implemented as a Kafka consumer
    // For now, we'll use the existing kafkaConsumerService pattern
    // See implementation in event-bus-consumer.service.ts
  }
}

export const eventBusService = new EventBusService()
```

### Step 2: Create Event Bus Consumer

**File: `backend/src/services/event-bus-consumer.service.ts`**

```typescript
import { kafkaConsumer } from '../config/kafka'
import { env } from '../config/env'
import type { MCPEvent } from './event-bus.service'

type EventHandler = (event: MCPEvent) => Promise<void>

export class EventBusConsumerService {
  private handlers: Map<string, EventHandler[]> = new Map()
  private isRunning = false

  /**
   * Register a handler for a specific event pattern
   * Pattern examples: "vision.captured", "vision.*", "*.captured"
   */
  registerHandler(pattern: string, handler: EventHandler): void {
    if (!this.handlers.has(pattern)) {
      this.handlers.set(pattern, [])
    }
    this.handlers.get(pattern)!.push(handler)
  }

  /**
   * Check if an event matches a pattern
   */
  private matchesPattern(event: string, pattern: string): boolean {
    // Simple pattern matching: * matches anything
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$')
    return regex.test(event)
  }

  /**
   * Start consuming events
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      return
    }

    await kafkaConsumer.subscribe({
      topics: ['mcp.events.all'],
      fromBeginning: false,
    })

    await kafkaConsumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        if (!message.value) return

        try {
          const event: MCPEvent = JSON.parse(message.value.toString())

          // Find matching handlers
          for (const [pattern, handlers] of this.handlers.entries()) {
            if (this.matchesPattern(event.event, pattern)) {
              for (const handler of handlers) {
                try {
                  await handler(event)
                } catch (error) {
                  console.error(`Error in event handler for ${pattern}:`, error)
                }
              }
            }
          }
        } catch (error) {
          console.error('Error processing event:', error)
        }
      },
    })

    this.isRunning = true
    console.log('✅ Event bus consumer started')
  }

  async stop(): Promise<void> {
    if (!this.isRunning) return
    await kafkaConsumer.stop()
    this.isRunning = false
  }
}

export const eventBusConsumerService = new EventBusConsumerService()
```

### Step 3: Add Event Emission to Tool Invocations

**File: `backend/src/routes/v0/invoke.ts`**

After successful tool invocation, emit an event:

```typescript
// After successful tool invocation:
if (result.success) {
  // Emit event for other servers to subscribe to
  await eventBusService.emit({
    event: `tool.${validated.tool}.completed`,
    serverId: validated.serverId,
    payload: {
      tool: validated.tool,
      arguments: validated.arguments,
      result: result.result,
    },
    conversationId: req.body.conversationId,
    correlationId: req.body.correlationId,
  })
}
```

### Step 4: Example: Vision → Researcher Workflow

**File: `backend/src/services/workflow-example.service.ts`**

```typescript
import { eventBusConsumerService } from './event-bus-consumer.service'
import { registryService } from './registry.service'
import type { MCPEvent } from './event-bus.service'

/**
 * Example workflow: When vision is captured, automatically process with researcher
 */
export function setupVisionToResearcherWorkflow() {
  // Subscribe to vision.captured events
  eventBusConsumerService.registerHandler('vision.captured', async (event: MCPEvent) => {
    console.log('Vision captured, triggering researcher processing...')
    
    // Find researcher server
    const researcherServer = await registryService.getServerById('com.researcher/mcp')
    if (!researcherServer) {
      console.warn('Researcher server not found')
      return
    }

    // Invoke researcher tool with vision data
    // This would call the invoke endpoint internally
    // Implementation depends on your architecture
  })
}
```

---

## 🔐 Part 3: Enhanced OAuth for Third-Party MCP Servers

### Architecture

```
┌─────────────────────────────────────────┐
│      OAuth Flow                         │
├─────────────────────────────────────────┤
│  1. MCP Server registers                │
│  2. User authorizes                     │
│  3. Tokens encrypted & stored           │
│  4. Tokens used for server calls        │
└─────────────────────────────────────────┘
```

### Step 1: Add Auth Field to MCP Server Schema

**File: `backend/prisma/schema.prisma`**

Add to `McpServer` model:

```prisma
model McpServer {
  // ... existing fields ...
  authConfig      String?  // JSON: OAuth2 configuration for third-party servers
  encryptedTokens String?  // Encrypted OAuth tokens (encrypted at rest)
  tokenExpiresAt  DateTime? // Token expiration
}
```

### Step 2: Create Token Encryption Service

**File: `backend/src/services/token-encryption.service.ts`**

```typescript
import { createCipheriv, createDecipheriv, randomBytes, scrypt } from 'crypto'
import { promisify } from 'util'

const scryptAsync = promisify(scrypt)

export class TokenEncryptionService {
  private algorithm = 'aes-256-gcm'
  private keyLength = 32
  private ivLength = 16
  private saltLength = 16

  /**
   * Get encryption key from environment variable or derive from secret
   */
  private async getKey(): Promise<Buffer> {
    const secret = process.env.ENCRYPTION_SECRET || 'default-secret-change-in-production'
    const salt = Buffer.from(process.env.ENCRYPTION_SALT || 'default-salt', 'utf-8')
    return (await scryptAsync(secret, salt, this.keyLength)) as Buffer
  }

  /**
   * Encrypt tokens before storing
   */
  async encrypt(tokens: {
    accessToken: string
    refreshToken?: string
    idToken?: string
  }): Promise<string> {
    const key = await this.getKey()
    const iv = randomBytes(this.ivLength)
    const salt = randomBytes(this.saltLength)

    const cipher = createCipheriv(this.algorithm, key, iv)
    
    const encrypted = Buffer.concat([
      cipher.update(JSON.stringify(tokens), 'utf-8'),
      cipher.final(),
    ])

    const authTag = cipher.getAuthTag()

    // Combine salt + iv + authTag + encrypted data
    const combined = Buffer.concat([
      salt,
      iv,
      authTag,
      encrypted,
    ])

    return combined.toString('base64')
  }

  /**
   * Decrypt tokens after retrieval
   */
  async decrypt(encryptedData: string): Promise<{
    accessToken: string
    refreshToken?: string
    idToken?: string
  }> {
    const combined = Buffer.from(encryptedData, 'base64')
    
    const salt = combined.subarray(0, this.saltLength)
    const iv = combined.subarray(this.saltLength, this.saltLength + this.ivLength)
    const authTag = combined.subarray(
      this.saltLength + this.ivLength,
      this.saltLength + this.ivLength + 16
    )
    const encrypted = combined.subarray(this.saltLength + this.ivLength + 16)

    const key = await this.getKey()
    const decipher = createDecipheriv(this.algorithm, key, iv)
    decipher.setAuthTag(authTag)

    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ])

    return JSON.parse(decrypted.toString('utf-8'))
  }
}

export const tokenEncryptionService = new TokenEncryptionService()
```

### Step 3: Enhanced OAuth Service for MCP Servers

**File: `backend/src/services/mcp-oauth.service.ts`**

```typescript
import { prisma } from '../config/database'
import { tokenEncryptionService } from './token-encryption.service'
import { registryService } from './registry.service'

export interface MCPOAuthConfig {
  authorizationUrl: string
  tokenUrl: string
  clientId: string
  clientSecret: string
  scopes: string[]
  redirectUri: string
}

export class MCPOAuthService {
  /**
   * Register OAuth configuration for an MCP server
   */
  async registerAuthConfig(
    serverId: string,
    config: MCPOAuthConfig
  ): Promise<void> {
    await prisma.mcpServer.update({
      where: { serverId },
      data: {
        authConfig: JSON.stringify(config),
      },
    })
  }

  /**
   * Initiate OAuth flow for a server
   */
  getAuthorizationUrl(serverId: string, state?: string): string {
    const server = await prisma.mcpServer.findUnique({
      where: { serverId },
    })

    if (!server || !server.authConfig) {
      throw new Error(`Server ${serverId} does not have OAuth configured`)
    }

    const config: MCPOAuthConfig = JSON.parse(server.authConfig)
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      response_type: 'code',
      scope: config.scopes.join(' '),
      ...(state && { state }),
    })

    return `${config.authorizationUrl}?${params.toString()}`
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCode(
    serverId: string,
    code: string
  ): Promise<void> {
    const server = await prisma.mcpServer.findUnique({
      where: { serverId },
    })

    if (!server || !server.authConfig) {
      throw new Error(`Server ${serverId} does not have OAuth configured`)
    }

    const config: MCPOAuthConfig = JSON.parse(server.authConfig)

    // Exchange code for tokens
    const response = await fetch(config.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: config.redirectUri,
        client_id: config.clientId,
        client_secret: config.clientSecret,
      }),
    })

    if (!response.ok) {
      throw new Error(`Token exchange failed: ${response.statusText}`)
    }

    const tokens = await response.json()

    // Encrypt and store tokens
    const encrypted = await tokenEncryptionService.encrypt({
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      idToken: tokens.id_token,
    })

    // Calculate expiration
    const expiresAt = tokens.expires_in
      ? new Date(Date.now() + tokens.expires_in * 1000)
      : null

    await prisma.mcpServer.update({
      where: { serverId },
      data: {
        encryptedTokens: encrypted,
        tokenExpiresAt: expiresAt,
      },
    })
  }

  /**
   * Get decrypted tokens for a server
   */
  async getTokens(serverId: string): Promise<{
    accessToken: string
    refreshToken?: string
    idToken?: string
  }> {
    const server = await prisma.mcpServer.findUnique({
      where: { serverId },
    })

    if (!server || !server.encryptedTokens) {
      throw new Error(`Server ${serverId} does not have stored tokens`)
    }

    // Check expiration
    if (server.tokenExpiresAt && server.tokenExpiresAt < new Date()) {
      // Refresh token if available
      if (server.encryptedTokens) {
        const tokens = await tokenEncryptionService.decrypt(server.encryptedTokens)
        if (tokens.refreshToken) {
          await this.refreshToken(serverId)
          return this.getTokens(serverId) // Recursive call after refresh
        }
      }
      throw new Error(`Tokens expired for server ${serverId}`)
    }

    return tokenEncryptionService.decrypt(server.encryptedTokens)
  }

  /**
   * Refresh access token
   */
  async refreshToken(serverId: string): Promise<void> {
    const server = await prisma.mcpServer.findUnique({
      where: { serverId },
    })

    if (!server || !server.authConfig || !server.encryptedTokens) {
      throw new Error(`Server ${serverId} does not have OAuth configured`)
    }

    const config: MCPOAuthConfig = JSON.parse(server.authConfig)
    const tokens = await tokenEncryptionService.decrypt(server.encryptedTokens)

    if (!tokens.refreshToken) {
      throw new Error(`No refresh token available for server ${serverId}`)
    }

    // Refresh token
    const response = await fetch(config.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: tokens.refreshToken,
        client_id: config.clientId,
        client_secret: config.clientSecret,
      }),
    })

    if (!response.ok) {
      throw new Error(`Token refresh failed: ${response.statusText}`)
    }

    const newTokens = await response.json()

    // Encrypt and store new tokens
    const encrypted = await tokenEncryptionService.encrypt({
      accessToken: newTokens.access_token,
      refreshToken: newTokens.refresh_token || tokens.refreshToken,
      idToken: newTokens.id_token || tokens.idToken,
    })

    const expiresAt = newTokens.expires_in
      ? new Date(Date.now() + newTokens.expires_in * 1000)
      : null

    await prisma.mcpServer.update({
      where: { serverId },
      data: {
        encryptedTokens: encrypted,
        tokenExpiresAt: expiresAt,
      },
    })
  }
}

export const mcpOAuthService = new MCPOAuthService()
```

### Step 4: Add OAuth Routes

**File: `backend/src/routes/auth/mcp-oauth.ts`**

```typescript
import { Router } from 'express'
import { mcpOAuthService } from '../../services/mcp-oauth.service'

const router = Router()

/**
 * GET /api/auth/mcp/:serverId/authorize
 * Initiate OAuth flow for an MCP server
 */
router.get('/:serverId/authorize', async (req, res) => {
  try {
    const { serverId } = req.params
    const state = req.query.state as string | undefined

    const authUrl = mcpOAuthService.getAuthorizationUrl(serverId, state)
    res.redirect(authUrl)
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to initiate OAuth',
    })
  }
})

/**
 * GET /api/auth/mcp/:serverId/callback
 * OAuth callback handler
 */
router.get('/:serverId/callback', async (req, res) => {
  try {
    const { serverId } = req.params
    const { code, state, error } = req.query

    if (error) {
      return res.status(400).json({
        success: false,
        error: `OAuth error: ${error}`,
      })
    }

    if (!code) {
      return res.status(400).json({
        success: false,
        error: 'Missing authorization code',
      })
    }

    await mcpOAuthService.exchangeCode(serverId, code as string)

    res.json({
      success: true,
      message: 'OAuth authorization successful',
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'OAuth callback failed',
    })
  }
})

export default router
```

---

## 📝 Implementation Checklist

### Memory System
- [ ] Fix Prisma schema duplicates
- [ ] Create `memory.service.ts`
- [ ] Add `search_history` tool handler
- [ ] Create memory API endpoints
- [ ] Update frontend to use memory

### Pub/Sub Bus
- [ ] Create `event-bus.service.ts`
- [ ] Create `event-bus-consumer.service.ts`
- [ ] Add event emission to tool invocations
- [ ] Create example workflows
- [ ] Add event subscription API

### Enhanced OAuth
- [ ] Add auth fields to Prisma schema
- [ ] Create `token-encryption.service.ts`
- [ ] Create `mcp-oauth.service.ts`
- [ ] Add OAuth routes
- [ ] Update server registration to include auth config
- [ ] Add token usage to tool invocations

---

## 🔒 Security Considerations

1. **Encryption Key Management**: Use environment variables or secrets manager
2. **Token Storage**: Always encrypt tokens at rest
3. **Token Rotation**: Implement automatic refresh
4. **Access Control**: Verify user permissions before token access
5. **Audit Logging**: Log all token access and OAuth flows

---

## 🚀 Next Steps

1. Run Prisma migration: `npm run migrate`
2. Set `ENCRYPTION_SECRET` and `ENCRYPTION_SALT` environment variables
3. Implement services in order (Memory → Pub/Sub → OAuth)
4. Add API endpoints
5. Update frontend to use new features
6. Test end-to-end workflows

---

**Status**: 📋 Implementation guide ready - follow steps sequentially
