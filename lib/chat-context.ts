/**
 * Chat Context Manager
 * 
 * Manages chat history and context for orchestrator workflows
 * Maintains 5-10 messages of context for follow-up questions
 */

export interface ChatContextMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  agentName?: string
  workflowId?: string // Links messages to the same workflow
  stepResults?: Record<string, unknown> // Results from workflow steps
}

export class ChatContextManager {
  private contextHistory: ChatContextMessage[] = []
  private maxContextLength = 10 // Keep last 10 messages

  /**
   * Add a message to context
   */
  addMessage(message: ChatContextMessage) {
    this.contextHistory.push(message)
    
    // Keep only last maxContextLength messages
    if (this.contextHistory.length > this.maxContextLength) {
      this.contextHistory = this.contextHistory.slice(-this.maxContextLength)
    }
  }

  /**
   * Get recent context for a query
   */
  getRecentContext(limit: number = 5): ChatContextMessage[] {
    return this.contextHistory.slice(-limit)
  }

  /**
   * Get full context
   */
  getFullContext(): ChatContextMessage[] {
    return [...this.contextHistory]
  }

  /**
   * Find related messages (e.g., previous workflow steps)
   */
  findRelatedMessages(workflowId?: string, agentName?: string): ChatContextMessage[] {
    return this.contextHistory.filter(msg => {
      if (workflowId && msg.workflowId === workflowId) return true
      if (agentName && msg.agentName === agentName) return true
      return false
    })
  }

  /**
   * Enhance query with context for follow-up questions
   */
  enhanceQueryWithContext(query: string): string {
    const recentContext = this.getRecentContext(5)
    
    // Check if this is a follow-up question
    const isFollowUp = /^(what|which|where|when|how|why|who|can you|do you|did you|are you)/i.test(query.trim())
    
    if (isFollowUp && recentContext.length > 0) {
      // Find the most recent user message that might be related
      const lastUserMessage = [...recentContext].reverse().find(msg => msg.role === 'user')
      const lastAssistantMessage = [...recentContext].reverse().find(msg => msg.role === 'assistant')
      
      if (lastUserMessage && lastAssistantMessage) {
        // Enhance query with context
        return `${lastUserMessage.content}\n\nFollow-up question: ${query}\n\nPrevious context: ${lastAssistantMessage.content.substring(0, 200)}...`
      }
    }
    
    return query
  }

  /**
   * Extract workflow context from recent messages
   */
  getWorkflowContext(): {
    currentWorkflow?: string
    lastStepResults?: Record<string, unknown>
    pendingActions?: string[]
  } {
    const recent = this.getRecentContext(5)
    const workflowMessages = recent.filter(msg => msg.workflowId)
    
    if (workflowMessages.length === 0) {
      return {}
    }

    const lastWorkflow = workflowMessages[workflowMessages.length - 1]
    return {
      currentWorkflow: lastWorkflow.workflowId,
      lastStepResults: lastWorkflow.stepResults,
      pendingActions: this.extractPendingActions(recent),
    }
  }

  /**
   * Extract pending actions from context
   */
  private extractPendingActions(messages: ChatContextMessage[]): string[] {
    const actions: string[] = []
    
    for (const msg of messages) {
      if (msg.role === 'user') {
        // Look for action verbs
        const actionMatch = msg.content.match(/(?:check|find|search|get|use|navigate to|go to) (.+?)(?:\.|$|,)/i)
        if (actionMatch) {
          actions.push(actionMatch[1].trim())
        }
      }
    }
    
    return actions
  }

  /**
   * Clear context
   */
  clear() {
    this.contextHistory = []
  }
}

// Singleton instance
let contextManagerInstance: ChatContextManager | null = null

export function getChatContextManager(): ChatContextManager {
  if (!contextManagerInstance) {
    contextManagerInstance = new ChatContextManager()
  }
  return contextManagerInstance
}

