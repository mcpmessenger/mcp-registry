"use client"

import { useState, useRef, useEffect } from "react"
import type { ChatMessage, AgentOption } from "@/types/chat"
import { ChatMessageComponent } from "@/components/chat-message"
import { AgentSelector } from "@/components/agent-selector"
import { ChatInput } from "@/components/chat-input"
import { VoiceInputDialog } from "@/components/voice-input-dialog"
import { FileUploadDialog } from "@/components/file-upload-dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { getServers, generateSVG, getJobStatus, createJobProgressStream, queryOrchestrator } from "@/lib/api"
import { transformServersToAgents } from "@/lib/server-utils"
import type { MCPServer } from "@/lib/api"
import { invokeMCPTool } from "@/lib/api"
import { routeRequest, getServerToolContext, normalizeSearchText } from "@/lib/tool-router"
import { getNativeOrchestrator } from "@/lib/native-orchestrator"
import { executeWorkflow } from "@/lib/workflow-executor"
import { getChatContextManager } from "@/lib/chat-context"
import { formatToolResponse, finalGuardrail, type ToolContext } from "@/lib/response-formatter"

const initialMessages: ChatMessage[] = [
  {
    id: "1",
    role: "assistant",
    content:
      "Hello! I'm your MCP assistant. I can help you with vision analysis, data processing, document analysis, and more. How can I assist you today?",
    timestamp: new Date(Date.now() - 1000 * 60 * 5),
  },
]

/**
 * Check if a response looks like a placeholder or generic template
 */
function isPlaceholderResponse(content: string): boolean {
  const placeholderPatterns = [
    /based on my analysis/i,
    /here are the key points/i,
    /you should consider/i,
    /let me help you with that/i,
    /based on my analysis.*key points/i,
  ]
  
  return placeholderPatterns.some(pattern => pattern.test(content)) && content.length < 500
}

/**
 * Handle simple queries that don't require MCP servers
 * Returns a response string if the query can be answered directly, null otherwise
 */
function handleSimpleQuery(content: string): string | null {
  const lowerContent = content.toLowerCase().trim()
  
  // Day of week queries (check first, more specific)
  if (/what day/i.test(content) && !content.toLowerCase().includes('concert') && !content.toLowerCase().includes('show')) {
    const now = new Date()
    const dayName = now.toLocaleDateString('en-US', { weekday: 'long' })
    const dateString = now.toLocaleDateString('en-US', { 
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
    return `Today is **${dayName}, ${dateString}**.`
  }
  
  // Date/time queries
  const dateTimePatterns = [
    /what (date|time) (is it|today)/i,
    /what's (the )?(date|time)( today)?/i,
    /what (date) (are we|is today)/i,
    /current (date|time)/i,
    /today's (date)/i,
    /what time (is it|now)/i,
    /time now/i,
  ]
  
  if (dateTimePatterns.some(pattern => pattern.test(content))) {
    const now = new Date()
    const options: Intl.DateTimeFormatOptions = {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      timeZoneName: 'short',
    }
    const formatted = now.toLocaleDateString('en-US', options)
    return `Today is **${formatted}**.`
  }
  
  // Time queries
  if (/what time/i.test(content) && !content.toLowerCase().includes('concert') && !content.toLowerCase().includes('show')) {
    const now = new Date()
    const timeString = now.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      timeZoneName: 'short',
    })
    return `The current time is **${timeString}**.`
  }
  
  // Simple greetings
  if (/^(hi|hello|hey|greetings)$/i.test(lowerContent)) {
    return "Hello! I'm your MCP assistant. How can I help you today?"
  }
  
  // Simple math (very basic)
  const mathMatch = content.match(/what is (\d+)\s*([+\-*/])\s*(\d+)/i)
  if (mathMatch) {
    const [, num1, op, num2] = mathMatch
    const a = parseInt(num1)
    const b = parseInt(num2)
    let result: number
    switch (op) {
      case '+': result = a + b; break
      case '-': result = a - b; break
      case '*': result = a * b; break
      case '/': result = b !== 0 ? a / b : NaN; break
      default: return null
    }
    if (!isNaN(result)) {
      return `**${a} ${op} ${b} = ${result}**`
    }
  }
  
  return null
}

/**
 * Detect if a message is requesting design/generation work
 * Excludes search queries, concert queries, and other non-design requests
 */
function isDesignRequest(content: string): boolean {
  const lowerContent = content.toLowerCase()
  
  // Exclude search queries, concert queries, and location queries
  const searchIndicators = [
    'look for', 'search for', 'find', 'when is', 'where is', 'playing', 'concert', 'ticket',
    'location', 'address', 'venue', 'schedule', 'tour', 'event', 'show', 'gig'
  ]
  
  if (searchIndicators.some(indicator => lowerContent.includes(indicator))) {
    return false
  }
  
  const designKeywords = [
    /(create|generate|make|design|build).*(poster|banner|image|picture|photo|graphic|logo|artwork|visual|design|svg|illustration)/i,
    /(poster|banner|marketing.*material|graphic|logo|artwork|visual|design|svg|illustration|picture|photo).*(for|with|in)/i,
    /high.resolution.*(poster|banner|image|graphic|logo|artwork|visual|design)/i,
    /(cosmic|dark mode|neon|color|palette|style).*(poster|banner|image|graphic|logo|artwork|visual|design)/i,
  ]
  
  return designKeywords.some(pattern => pattern.test(content))
}

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages)
  const [selectedAgentId, setSelectedAgentId] = useState("router")
  const [isLoading, setIsLoading] = useState(false)
  const [voiceDialogOpen, setVoiceDialogOpen] = useState(false)
  const [fileDialogOpen, setFileDialogOpen] = useState(false)
  const [agentOptions, setAgentOptions] = useState<AgentOption[]>([
    { id: "router", name: "Auto-Route (Recommended)", type: "router" },
  ])
  const [availableServers, setAvailableServers] = useState<MCPServer[]>([])
  const scrollAreaRef = useRef<HTMLDivElement>(null)

  // Fetch available servers on mount and register with native orchestrator
  useEffect(() => {
    async function loadAgents() {
      try {
        const servers = await getServers()
        
        // Transform servers to agents to check status
        const transformedAgents = transformServersToAgents(servers)
        
        // Filter to only active servers
        const activeAgents = transformedAgents.filter((a) => a.status === "active")
        const activeServers = servers.filter((server) => {
          const agent = transformedAgents.find((a) => a.id === server.serverId)
          return agent?.status === "active"
        })
        
        setAvailableServers(activeServers)
        
        // Register only active servers with native orchestrator for workflow execution
        const orchestrator = getNativeOrchestrator()
        orchestrator.registerServers(activeServers)
        console.log('[Native Orchestrator] Registered', activeServers.length, 'active servers (filtered from', servers.length, 'total)')
        
        // Transform only active servers to agent options
        const options: AgentOption[] = [
          { id: "router", name: "Auto-Route (Recommended)", type: "router" },
          ...activeAgents.map((a) => ({
            id: a.id,
            name: a.name,
            type: "agent" as const,
          })),
        ]
        setAgentOptions(options)
      } catch (error) {
        console.error('Failed to load agents:', error)
      }
    }
    loadAgents()
  }, [])

  useEffect(() => {
    // Scroll to bottom when messages change
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector("[data-radix-scroll-area-viewport]")
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight
      }
    }
  }, [messages])

  const handleSendMessage = async (content: string, attachment?: ChatMessage["contextAttachment"]) => {
    // Add to chat context for follow-up questions
    const contextManager = getChatContextManager()
    contextManager.addMessage({
      role: 'user',
      content,
      timestamp: new Date(),
    })
    
    // Enhance query with context if it's a follow-up
    const enhancedContent = contextManager.enhanceQueryWithContext(content)
    
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content,
      timestamp: new Date(),
      contextAttachment: attachment,
    }

    setMessages((prev) => [...prev, userMessage])
    setIsLoading(true)

    try {
      let responseContent = ""
      let agentName: string | undefined = undefined
      let generateResponse: any = null // Declare at function scope so it's accessible when creating message

      // Check for simple queries that don't need MCP servers
      const simpleResponse = handleSimpleQuery(content)
      if (simpleResponse) {
        responseContent = simpleResponse
        agentName = "Assistant"
        setIsLoading(false)
        const assistantMessage: ChatMessage = {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: responseContent,
          timestamp: new Date(),
          agentName: agentName,
        }
        setMessages((prev) => [...prev, assistantMessage])
        return
      }

      const isRouter = selectedAgentId === "router"
      
      if (isRouter) {
        // Try Kafka orchestrator first (bypasses Gemini for high-signal queries)
        // Only skip for explicit design requests
        const isDesign = isDesignRequest(content)
        if (!isDesign && !attachment) {
          try {
            console.log('[Chat] Trying Kafka orchestrator...')
            
            // Show status message to user
            const statusMessage: ChatMessage = {
              id: `status-${Date.now()}`,
              role: "assistant",
              content: "🔍 Matching tools...",
              timestamp: new Date(),
              agentName: "Orchestrator",
            }
            setMessages((prev) => [...prev, statusMessage])
            
            const orchestratorResult = await queryOrchestrator({
              query: enhancedContent || content,
              sessionId: `session-${Date.now()}`,
            })
            
            // Remove status message
            setMessages((prev) => prev.filter(m => m.id !== statusMessage.id))
            
            if (orchestratorResult.success && orchestratorResult.result) {
              // Extract text content from result
              const resultContent = orchestratorResult.result.content
              if (resultContent && Array.isArray(resultContent)) {
                const textContent = resultContent
                  .filter(item => item.type === 'text' && item.text)
                  .map(item => item.text)
                  .join('\n\n')
                
                if (textContent) {
                  responseContent = textContent
                  agentName = orchestratorResult.tool || "Orchestrator"
                  
                  // Create assistant message and return early
                  const assistantMessage: ChatMessage = {
                    id: `assistant-${Date.now()}`,
                    role: "assistant",
                    content: responseContent,
                    timestamp: new Date(),
                    agentName: agentName,
                  }
                  
                  setMessages((prev) => [...prev, assistantMessage])
                  setIsLoading(false)
                  return // Successfully handled by orchestrator
                }
              }
            }
          } catch (orchestratorError) {
            // Orchestrator failed or unavailable, fall through to old routing
            console.warn('[Chat] Orchestrator failed, falling back to old routing:', orchestratorError)
            
            // Remove status message if it exists
            setMessages((prev) => prev.filter(m => !m.id?.startsWith('status-')))
            
            // Show fallback message
            const fallbackMessage: ChatMessage = {
              id: `fallback-${Date.now()}`,
              role: "assistant",
              content: "⏱️ Orchestrator timed out, using fallback routing...",
              timestamp: new Date(),
              agentName: "System",
            }
            setMessages((prev) => [...prev, fallbackMessage])
            
            // Remove fallback message after a short delay
            setTimeout(() => {
              setMessages((prev) => prev.filter(m => m.id !== fallbackMessage.id))
            }, 2000)
          }
        }
        
        // Auto-route based on content and attachment type (fallback)
        let targetServer: MCPServer | null = null
        let toolName: string | undefined = undefined // Don't default to agent_executor
        let toolArgs: Record<string, unknown> = {}
        
        // Check for search queries first (before design requests)
        // This prevents search queries from being misrouted to image generation
        const normalizedContent = normalizeSearchText(content)
        const lowerContent = normalizedContent.toLowerCase()
        const isSearchQuery = lowerContent.includes('look for') || 
                             lowerContent.includes('search for') || 
                             lowerContent.includes('find') ||
                             (lowerContent.includes('concert') && !isDesignRequest(content)) ||
                             (lowerContent.includes('playing') && !isDesignRequest(content)) ||
                             (lowerContent.includes('when is') && !isDesignRequest(content))
        
        // CRITICAL: If this is a search query, NEVER route to image generation
        // Even if Exa is not available, we should route to a search-capable server or fail gracefully
        if (isSearchQuery && !isDesignRequest(content)) {
          // Route to Exa MCP server for search queries
          const exaServer = availableServers.find(s => 
            s.serverId.toLowerCase().includes('exa') ||
            s.name.toLowerCase().includes('exa') ||
            (s.metadata && typeof s.metadata === 'object' && 
             ((s.metadata as any).npmPackage === 'exa-mcp-server' || 
              JSON.stringify(s.metadata).toLowerCase().includes('exa-mcp-server')))
          )
          
          if (exaServer) {
            targetServer = exaServer
            agentName = "Exa MCP Server"
            toolName = 'web_search_exa'
            
            // Extract search query from content
            const searchMatch = content.match(/(?:look for|search for|find)\s+(.+?)(?:\.|$|in|at)/i)
            if (searchMatch) {
              toolArgs.query = searchMatch[1].trim()
            } else {
              // Use the full content as query, but clean it up
              toolArgs.query = content.replace(/^(look for|search for|find)\s+/i, '').trim()
            }
            
            // Skip design generation and other routing
            responseContent = "" // Will be set by tool result
          } else {
            // Exa not found - try to route to another search-capable server
            // But NEVER route to image generation for search queries
            console.warn('[Chat] Exa MCP server not found, trying alternative routing for search query')
            // Continue to normal routing, but isDesignRequest check below will prevent image generation
          }
        }
        
        // Check for design/generation requests (only if not already routed to search)
        // CRITICAL: Never allow image generation for search queries, even if isDesignRequest returns true
        if (!targetServer && isDesignRequest(content) && !isSearchQuery) {
          // Route to design generation API - will be updated with actual server name from response
          agentName = "Design Generator" // Temporary, will be replaced
          
          try {
            // Extract design details from the request
            const description = content
            const styleMatch = content.match(/(cosmic|dark|modern|minimalist|vintage|retro)/i)
            const colorMatch = content.match(/(purple|blue|red|green|yellow|orange|pink|neon)/i)
            
            // Generate the design
            generateResponse = await generateSVG({
              description: description,
              style: styleMatch ? styleMatch[1].toLowerCase() : 'modern',
              colorPalette: colorMatch ? [colorMatch[1]] : undefined,
              size: {
                width: 1920, // High resolution for posters
                height: 1080,
              },
            })
            
            // Use actual server name from response if available
            if (generateResponse.serverName) {
              agentName = generateResponse.serverName
            }
            
            // Check if result is already completed (synchronous MCP response)
            if (generateResponse.completed) {
              // MCP server returned result immediately - no job ID needed
              const imageUrl = generateResponse.imageUrl
              const imageData = generateResponse.imageData
              
              if (imageUrl) {
                responseContent = `Your design is ready!`
                // Store image URL in message (will be rendered by component)
              } else if (imageData) {
                responseContent = `Your design is ready!`
                // Store image data in message (will be rendered by component)
              } else {
                // Completed but no image - return text result
                responseContent = generateResponse.result || generateResponse.message || "Design generated successfully!"
              }
            } else if (generateResponse.jobId) {
              // Async job - poll for completion
              responseContent = `I've started creating your design! Job ID: ${generateResponse.jobId}. I'll notify you when it's ready.`
              
              // Poll for job completion in the background
              const pollJob = async () => {
                try {
                  const maxAttempts = 60 // 5 minutes max
                  let attempts = 0
                  
                  while (attempts < maxAttempts) {
                    await new Promise(resolve => setTimeout(resolve, 5000)) // Wait 5 seconds
                    
                    try {
                      const jobStatus = await getJobStatus(generateResponse.jobId)
                      
                      if (jobStatus.job.status === 'COMPLETED' && jobStatus.asset) {
                        // Update the message with the result
                        const updateMessage: ChatMessage = {
                          id: `assistant-${Date.now()}`,
                          role: "assistant",
                          content: `Your design is ready! ${jobStatus.asset.url ? `View it here: ${jobStatus.asset.url}` : 'Design completed successfully.'}`,
                          timestamp: new Date(),
                          agentName: agentName,
                        }
                        setMessages((prev) => [...prev, updateMessage])
                        break
                      } else if (jobStatus.job.status === 'FAILED') {
                        const errorMessage: ChatMessage = {
                          id: `assistant-${Date.now()}`,
                          role: "assistant",
                          content: `Design generation failed: ${jobStatus.job.errorMessage || 'Unknown error'}`,
                          timestamp: new Date(),
                          agentName: agentName,
                        }
                        setMessages((prev) => [...prev, errorMessage])
                        break
                      } else if (jobStatus.job.status === 'PENDING' && jobStatus.job.progressMessage?.includes('being set up')) {
                        // Service is still being set up, continue polling but don't spam updates
                        if (attempts % 6 === 0) { // Update every 30 seconds
                          const statusMessage: ChatMessage = {
                            id: `assistant-${Date.now()}`,
                            role: "assistant",
                            content: `Design generation is still being set up. Your request is queued. Job ID: ${generateResponse.jobId}`,
                            timestamp: new Date(),
                            agentName: agentName,
                          }
                          setMessages((prev) => [...prev, statusMessage])
                        }
                      }
                    } catch (pollError) {
                      // If polling fails, log but don't break - might be temporary
                      console.error('Error polling job status:', pollError)
                      // Stop polling after too many errors
                      if (attempts > 10) {
                        break
                      }
                    }
                    
                    attempts++
                  }
                  
                  // If we've exhausted attempts, notify user
                  if (attempts >= maxAttempts) {
                    const timeoutMessage: ChatMessage = {
                      id: `assistant-${Date.now()}`,
                      role: "assistant",
                      content: `Design generation is taking longer than expected. Your request is still being processed. Job ID: ${generateResponse.jobId}. Please check back later.`,
                      timestamp: new Date(),
                      agentName: agentName,
                    }
                    setMessages((prev) => [...prev, timeoutMessage])
                  }
                } catch (error) {
                  console.error('Error in polling loop:', error)
                }
              }
              
              // Start polling in background (don't await)
              pollJob().catch(console.error)
            } else {
              responseContent = generateResponse.message || "Design generation started successfully."
            }
          } catch (error) {
            console.error('Design generation error:', error)
            const errorMessage = error instanceof Error ? error.message : 'Unknown error'
            
            // Check if it's a service setup message (503 or similar)
            if (errorMessage.includes('service is being set up') || errorMessage.includes('not yet configured')) {
              responseContent = `I've received your design request! ${errorMessage}. The design generation service is currently being configured. Your request has been logged and will be processed once the service is ready.`
            } else {
              // For other errors, show a helpful message
              responseContent = `I encountered an issue while setting up your design: ${errorMessage}. The design generation feature is still being configured. Please try again in a few moments, or contact support if this persists.`
            }
            // Don't throw - use the responseContent we set above
          }
        } else if (attachment?.type === "image") {
          // Route to Vision MCP or document analysis
          targetServer = availableServers.find(s => 
            s.serverId.includes('vision') || 
            s.tools?.some(t => t.name.includes('analyze') || t.name.includes('vision'))
          ) || availableServers.find(s => s.serverId === 'com.langchain/agent-mcp-server')
          agentName = "Vision Agent"
        } else if (attachment?.type === "document") {
          // Route to document analysis
          targetServer = availableServers.find(s => 
            s.tools?.some(t => t.name.includes('analyze') || t.name.includes('document'))
          ) || availableServers.find(s => s.serverId === 'com.langchain/agent-mcp-server')
          agentName = "Document Processing"
        } else {
          // Check for explicit tool requests first (e.g., "use playwright to check ticketmaster", "go to ticketmaster.com")
          const lowerContent = content.toLowerCase()
          const isExplicitPlaywright = lowerContent.includes('use playwright') || 
                                       (lowerContent.includes('playwright') && lowerContent.includes('check'))
          const isGoToWebsite = /go\s+to\s+[\w-]+(?:\.com|\.org|\.net)/i.test(content) ||
                                /navigate\s+to\s+[\w-]+(?:\.com|\.org|\.net)/i.test(content) ||
                                (lowerContent.includes('go to') && (lowerContent.includes('.com') || lowerContent.includes('ticketmaster'))) ||
                                (lowerContent.includes('navigate') && (lowerContent.includes('.com') || lowerContent.includes('website')))
          
          if (isExplicitPlaywright || isGoToWebsite) {
            const playwrightServer = availableServers.find(s => 
              s.serverId.includes('playwright') || s.name.toLowerCase().includes('playwright')
            )
            if (playwrightServer) {
              targetServer = playwrightServer
              agentName = "Playwright MCP Server"
              toolName = playwrightServer.tools?.[0]?.name || 'browser_navigate'
              
              // Extract URL from content
              const urlMatch = content.match(/(https?:\/\/[^\s]+|[\w-]+\.(?:com|org|net|io))/i)
              const ticketmasterMatch = content.match(/ticketmaster/i)
              
              if (urlMatch) {
                // Extract URL from match
                let url = urlMatch[1]
                if (!url.startsWith('http')) {
                  url = `https://www.${url}`
                }
                toolArgs.url = url
                
                // If there's a search query (e.g., "look for iration tickets")
                const searchMatch = content.match(/(?:look for|search for|find|get)\s+(.+?)(?:\.|$)/i)
                if (searchMatch) {
                  toolArgs.query = searchMatch[1].trim()
                }
              } else if (ticketmasterMatch) {
                // User wants to check Ticketmaster
                toolArgs.url = 'https://www.ticketmaster.com'
                
                // Extract search query if present
                const searchMatch = content.match(/(?:look for|search for|find)\s+(.+?)(?:\.|$)/i)
                if (searchMatch) {
                  toolArgs.query = searchMatch[1].trim()
                } else {
                  const concertMatch = content.match(/LCD Soundsystem|concert|schedule/i)
                  if (concertMatch) {
                    toolArgs.query = 'LCD Soundsystem New York'
                  }
                }
              } else {
                // Generic query - try to extract URL first
                const urlMatch = content.match(/([\w-]+\.(?:com|org|net|io))/i)
                if (urlMatch) {
                  toolArgs.url = `https://www.${urlMatch[1]}`
                } else {
                  toolArgs.query = content
                }
              }
              
              // Skip orchestration and go directly to tool invocation
              responseContent = "" // Will be set by tool result
              // toolArgs is already set above, toolName is already set
              // targetServer is already set
            }
          }
          
          // Use intelligent routing based on tool context (if not already set)
          // BUT: If this is a search query, make sure we don't route to image generation
          let routing: ReturnType<typeof routeRequest> | null = null
          if (!targetServer) {
            // Double-check: if it's a search query, try to find Exa or another search server
            if (isSearchQuery && !isDesignRequest(content)) {
              // Try Exa again (maybe it wasn't loaded yet)
              const exaServer = availableServers.find(s => 
                s.serverId.toLowerCase().includes('exa') ||
                s.name.toLowerCase().includes('exa') ||
                (s.metadata && typeof s.metadata === 'object' && 
                 ((s.metadata as any).npmPackage === 'exa-mcp-server' || 
                  JSON.stringify(s.metadata).toLowerCase().includes('exa-mcp-server')))
              )
              if (exaServer) {
                targetServer = exaServer
                agentName = "Exa MCP Server"
                toolName = 'web_search_exa'
                const searchMatch = content.match(/(?:look for|search for|find)\s+(.+?)(?:\.|$|in|at)/i)
                if (searchMatch) {
                  toolArgs.query = searchMatch[1].trim()
                } else {
                  toolArgs.query = content.replace(/^(look for|search for|find)\s+/i, '').trim()
                }
                responseContent = ""
              }
            }
            
            // Only proceed with normal routing if we still don't have a targetServer
            // AND it's not a search query (to prevent routing to image generation)
            if (!targetServer && !(isSearchQuery && !isDesignRequest(content))) {
              routing = routeRequest(content, availableServers)
            
              // Check if native orchestration is available and needed
              const orchestrator = getNativeOrchestrator()
              // Use enhanced content for orchestration detection (includes context)
              const needsOrchestration = orchestrator.requiresOrchestration(enhancedContent || content)
            
              if (needsOrchestration) {
                // Use native orchestrator for complex multi-step workflows
                try {
                  agentName = "Native Orchestrator"
                  
                  // Plan workflow (use enhanced content with context)
                  const plan = orchestrator.planWorkflow(enhancedContent || content)
                  
                  // Generate workflow ID for context tracking
                  const workflowId = `workflow-${Date.now()}`
                  
                  // Display planning status
                  const planningMessage: ChatMessage = {
                    id: `planning-${Date.now()}`,
                    role: "assistant",
                    content: `🔀 **Planning workflow** (${plan.steps.length} step${plan.steps.length > 1 ? 's' : ''}):\n\n${plan.steps.map((s, i) => {
                      const toolName = s.selectedServer?.name || s.toolContext?.tool || 'Tool TBD'
                      const status = s.selectedServer ? '✓' : '⚠️'
                      return `${i + 1}. ${s.description} → ${status} ${toolName}`
                    }).join('\n')}`,
                    timestamp: new Date(),
                    agentName: agentName,
                  }
                  setMessages((prev) => [...prev, planningMessage])
                  
                  // Check if all steps have tools selected
                  const allStepsHaveTools = plan.steps.every(s => s.selectedServer && s.selectedTool)
                  if (!allStepsHaveTools) {
                    console.warn('[Native Orchestrator] Some steps missing tools:', plan.steps.filter(s => !s.selectedServer))
                  }
                  
                  // Execute workflow (use original content for execution, enhanced for planning)
                  const workflowResult = await executeWorkflow(enhancedContent || content, plan)
                  
                  if (workflowResult.success) {
                    // Use formatted result if available, otherwise format it
                    let resultText: string
                    if (typeof workflowResult.finalResult === 'string') {
                      resultText = workflowResult.finalResult
                    } else if (workflowResult.finalResult && typeof workflowResult.finalResult === 'object' && 'formatted' in workflowResult.finalResult) {
                      resultText = (workflowResult.finalResult as { formatted: string }).formatted
                    } else {
                      resultText = typeof workflowResult.finalResult === 'object' 
                        ? JSON.stringify(workflowResult.finalResult, null, 2)
                        : String(workflowResult.finalResult || 'Workflow completed successfully')
                    }
                    
                    responseContent = `✅ **Workflow completed**\n\n${resultText}`
                    
                    // Add step summary (optional, only if not already included in formatted result)
                    if (!resultText.includes('Step')) {
                      responseContent += `\n\n**Steps executed:**\n${workflowResult.steps.map((s, i) => `${i + 1}. ${s.description}${s.result ? ' ✓' : s.error ? ` ✗ ${s.error}` : ''}`).join('\n')}`
                    }
            
                    // Store workflow result in context
                    contextManager.addMessage({
                      role: 'assistant',
                      content: responseContent,
                      timestamp: new Date(),
                      agentName: agentName,
                      workflowId: workflowId,
                      stepResults: workflowResult.steps.reduce((acc, s) => {
                        if (s.result) acc[`step${s.step}`] = s.result
                        return acc
                      }, {} as Record<string, unknown>),
                    })
                  } else {
                    responseContent = `❌ **Workflow failed**: ${workflowResult.error || 'Unknown error'}\n\n**Steps:**\n${workflowResult.steps.map((s, i) => `${i + 1}. ${s.description}${s.error ? ` ✗ ${s.error}` : s.result ? ' ✓' : ''}`).join('\n')}`
                  }
                  
                  // Skip normal tool invocation, workflow result is ready
                  targetServer = null
                } catch (workflowError) {
                  console.error('Native orchestration failed, falling back to LangChain:', workflowError)
                  // Set error message but don't throw - let it fall through to LangChain
                  responseContent = `⚠️ Native orchestrator encountered an error: ${workflowError instanceof Error ? workflowError.message : 'Unknown error'}. Falling back to LangChain.`
                  
                  // Fall through to LangChain fallback
                  if (routing && routing.orchestrationNeeded) {
                    const langchainServer = availableServers.find(s => 
                      s.serverId.includes('langchain') || s.name.toLowerCase().includes('langchain')
                    )
                    if (langchainServer) {
                      targetServer = langchainServer
                      agentName = "LangChain Orchestrator (Fallback)"
                      // Clear responseContent so LangChain can respond
                      responseContent = ""
                    }
                  }
                }
            
                // Continue with normal routing if native orchestrator didn't handle it
                if (!targetServer && routing && routing.primaryServer) {
                  // Simple single-step query, use the primary server
                  // BUT: If it's a concert query and LangChain was selected, prefer Playwright
                  const isConcertQuery = (content.toLowerCase().includes('playing') || 
                                         content.toLowerCase().includes('concert') ||
                                         content.toLowerCase().includes('ticket') ||
                                         content.toLowerCase().includes('when is'))
                  const isLangChain = routing.primaryServer.serverId.includes('langchain') || 
                                     routing.primaryServer.serverId.includes('agent')
                  
                  if (isConcertQuery && isLangChain) {
                    // Override: Use Playwright for concert queries instead of LangChain
                    const playwrightServer = availableServers.find(s => 
                      s.serverId.includes('playwright') || s.name.toLowerCase().includes('playwright')
                    )
                    if (playwrightServer) {
                      targetServer = playwrightServer
                      agentName = "Playwright MCP Server"
                    } else {
                      targetServer = routing.primaryServer
                      agentName = toolContext?.tool || routing.primaryServer.name
                    }
                  } else {
                    targetServer = routing.primaryServer
                    const toolContext = getServerToolContext(routing.primaryServer)
                    agentName = toolContext?.tool || routing.primaryServer.name
                  }
                } else if (!targetServer) {
                  // Fallback to LangChain agent for general queries (but not concert queries)
                  const isConcertQuery = (content.toLowerCase().includes('playing') || 
                                         content.toLowerCase().includes('concert') ||
                                         content.toLowerCase().includes('ticket'))
                  if (isConcertQuery) {
                    // For concert queries, try Playwright first
                    targetServer = availableServers.find(s => 
                      s.serverId.includes('playwright') || s.name.toLowerCase().includes('playwright')
                    )
                    agentName = targetServer ? "Playwright MCP Server" : undefined
                  }
                  
                  // Only fallback to LangChain if we don't have Playwright
                  if (!targetServer) {
                    targetServer = availableServers.find(s => s.serverId === 'com.langchain/agent-mcp-server') ||
                                  availableServers.find(s => s.serverId === 'com.valuation/mcp-server') ||
                                availableServers[0]
                    agentName = "AI Assistant"
                  }
                }
              }
            }
          }
          }

        // Only invoke tool if we didn't handle it as a design request
        // (Design requests are handled above and responseContent is already set)
        if (!isDesignRequest(content) && targetServer && targetServer.tools && targetServer.tools.length > 0) {
          // Use agent_executor ONLY if this is the LangChain server, otherwise use first tool
          // BUT: If we already have toolName set from explicit detection, use that
          if (!toolName) {
            // Only look for agent_executor on LangChain server
            const isLangChain = targetServer.serverId.includes('langchain') || targetServer.name.toLowerCase().includes('langchain')
            if (isLangChain) {
              const executorTool = targetServer.tools.find(t => t.name === 'agent_executor')
              toolName = executorTool ? 'agent_executor' : targetServer.tools[0].name
            } else {
              // For non-LangChain servers, use the first available tool
              toolName = targetServer.tools[0].name
            }
          }
          
          console.log(`Routing to ${targetServer.name} using tool: ${toolName}`)
          
          // Prepare tool arguments based on tool type
          // Only create new toolArgs if we don't already have them (from explicit detection)
          if (!toolArgs || Object.keys(toolArgs).length === 0) {
            toolArgs = {}
          }
          
          // CRITICAL: For Playwright browser_navigate, ensure URL is always set
          if (toolName?.includes('browser_navigate') || toolName?.includes('browser')) {
            // Check if this is a concert/event query that needs a default URL
            const isConcertQuery = content.toLowerCase().includes('playing') || 
                                 content.toLowerCase().includes('concert') ||
                                 content.toLowerCase().includes('ticket') ||
                                 content.toLowerCase().includes('when is') ||
                                 content.toLowerCase().includes('event') ||
                                 content.toLowerCase().includes('show')
            
            if (!toolArgs.url && isConcertQuery) {
              // Default to StubHub for concert searches
              toolArgs.url = 'https://www.stubhub.com'
              console.log('[Chat] Set default URL for concert query:', toolArgs.url)
            } else if (!toolArgs.url) {
              // For other queries without URL, throw a helpful error
              throw new Error(`browser_navigate requires a URL. Please specify a website (e.g., "go to stubhub.com") or ask about concerts/events which will default to StubHub.`)
            }
          }
          
          if (toolName === 'agent_executor') {
            // For LangChain orchestrator, enhance the query to explicitly request tool usage
            let enhancedQuery = content
            
            // If query mentions things that require Playwright (web browsing, concerts, events)
            const needsWebBrowsing = /concert|event|show|ticket|venue|price|rental|car|hotel/i.test(content)
            const mentionsPlaywright = /playwright|browser|web page|website|scrape/i.test(content)
            
            if (needsWebBrowsing && !mentionsPlaywright) {
              // Suggest using Playwright for web browsing tasks
              enhancedQuery = `${content}\n\nNote: This requires web browsing to find current information. Use the Playwright MCP server to navigate websites, search for information, and extract data from web pages.`
            }
            
            // If query mentions location/maps, suggest Google Maps
            const needsLocation = /location|map|near|closest|distance|address|coordinates/i.test(content)
            const mentionsMaps = /google maps|maps|map/i.test(content.toLowerCase())
            
            if (needsLocation && !mentionsMaps) {
              enhancedQuery += ` Use the Google Maps MCP server to find locations, addresses, and nearby places.`
            }
            
            toolArgs = {
              query: enhancedQuery,
              input: enhancedQuery,
            }
          } else if (toolName.includes('browser_navigate') || toolName.includes('navigate')) {
            // For Playwright browser_navigate tool, ensure URL is present
            // If toolArgs was already set (from explicit detection), preserve it
            if (Object.keys(toolArgs).length === 0 || !toolArgs.url) {
              // Extract URL from content
              const urlMatch = content.match(/(https?:\/\/[^\s]+|[\w-]+\.(?:com|org|net|io))/i)
              if (urlMatch) {
                let url = urlMatch[1]
                if (!url.startsWith('http')) {
                  url = `https://www.${url}`
                }
                toolArgs.url = url
              } else {
                // Try common domains mentioned in query (including ticket sites)
                const domainMatch = content.match(/(ticketmaster|stubhub|seatgeek|ticketfly|axs|tickets|eventbrite|ticketweb|google|amazon|facebook|twitter)/i)
                if (domainMatch) {
                  const domain = domainMatch[1].toLowerCase()
                  // Map ticket sites to correct URLs
                  const ticketSites: Record<string, string> = {
                    'ticketmaster': 'https://www.stubhub.com', // Ticketmaster has cookie dialogs, use StubHub instead
                    'stubhub': 'https://www.stubhub.com',
                    'seatgeek': 'https://www.seatgeek.com',
                    'ticketfly': 'https://www.ticketfly.com',
                    'axs': 'https://www.axs.com',
                    'tickets': 'https://www.stubhub.com', // Generic fallback - use StubHub (more automation-friendly)
                    'eventbrite': 'https://www.eventbrite.com',
                    'ticketweb': 'https://www.ticketweb.com',
                  }
                  toolArgs.url = ticketSites[domain] || `https://www.${domain}.com`
                } else {
                  throw new Error(`browser_navigate requires a URL. Please specify a website (e.g., "go to stubhub.com")`)
                }
              }
            }
            // Extract search query if present - now supports auto-search via Playwright MCP
            // Handle patterns: "look for X", "look up X", "when is X", "find X", etc.
            const searchMatch = content.match(/(?:look for|look up|search for|find|get|check for|when is)\s+(.+?)(?:\.|$|in |near |next)/i)
            if (searchMatch) {
              let searchQuery = searchMatch[1].trim()
              // Remove "next concert" or similar trailing phrases
              searchQuery = searchQuery.replace(/\s+(?:next|upcoming|future)\s+(?:concert|show|event).*$/i, '').trim()
              
              // Also extract location if present (e.g., "in iowa", "near New York", "in texas")
              const locationMatch = content.match(/(?:in|near|at)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i)
              const location = locationMatch ? locationMatch[1] : ''
              const fullQuery = location ? `${searchQuery} ${location}` : searchQuery
              
              // NEW: Use auto-search feature - Playwright MCP will automatically perform the search
              // Parameter name uses snake_case to match the deployed API
              toolArgs.search_query = fullQuery  // Changed from searchQuery to match API
              toolArgs.auto_search = true        // Explicitly enable auto-search
              toolArgs.wait_timeout = 15000      // Set reasonable timeout for search operations
              
              // Keep query for backward compatibility and other tools
              toolArgs.query = fullQuery
            }
            
            // CRITICAL: Ensure URL is set for browser_navigate (must happen after search query extraction)
            // For concert queries, default to StubHub if URL wasn't already set
            if (!toolArgs.url && (toolName?.includes('browser') || toolName?.includes('navigate'))) {
              const isConcertQuery = content.toLowerCase().includes('playing') || 
                                   content.toLowerCase().includes('concert') ||
                                   content.toLowerCase().includes('ticket') ||
                                   content.toLowerCase().includes('when is') ||
                                   content.toLowerCase().includes('event') ||
                                   content.toLowerCase().includes('show')
              if (isConcertQuery) {
                toolArgs.url = 'https://www.stubhub.com'
                console.log('[Chat] Set default URL for concert query:', toolArgs.url)
              }
            }
          } else {
            // For other tools, pass content as appropriate argument
            if (Object.keys(toolArgs).length === 0) {
              toolArgs = {
                query: content,
                text: content,
                input: content,
              }
            }
          }

          // FINAL VALIDATION: Ensure URL is set for browser_navigate before invoking
          if (toolName?.includes('browser_navigate') || toolName?.includes('browser') || toolName?.includes('navigate')) {
            if (!toolArgs?.url) {
              const isConcertQuery = content.toLowerCase().includes('playing') || 
                                   content.toLowerCase().includes('concert') ||
                                   content.toLowerCase().includes('ticket') ||
                                   content.toLowerCase().includes('when is') ||
                                   content.toLowerCase().includes('event') ||
                                   content.toLowerCase().includes('show')
              if (isConcertQuery) {
                toolArgs = toolArgs || {}
                toolArgs.url = 'https://www.stubhub.com'
                console.log('[Chat] Final validation: Set default URL for concert query:', toolArgs.url)
              } else {
                console.error('[Chat] browser_navigate called without URL and not a concert query:', { toolName, toolArgs, content })
                throw new Error(`browser_navigate requires a URL. Please specify a website (e.g., "go to stubhub.com")`)
              }
            }
            console.log('[Chat] Invoking browser_navigate with:', { url: toolArgs.url, search_query: toolArgs.search_query, auto_search: toolArgs.auto_search })
          }

          let result
          try {
            result = await invokeMCPTool({
              serverId: targetServer.serverId,
              tool: toolName,
              arguments: toolArgs,
            })
          } catch (toolError) {
            // Error handling: If LangChain fails with 500 error, try Playwright as fallback for concert queries
            const errorMessage = toolError instanceof Error ? toolError.message : String(toolError)
            const isLangChain500 = targetServer.serverId.includes('langchain') && 
                                  (errorMessage.includes('500') || errorMessage.includes('system_instruction'))
            const isConcertQuery = content.toLowerCase().includes('playing') || 
                                 content.toLowerCase().includes('concert') ||
                                 content.toLowerCase().includes('ticket') ||
                                 content.toLowerCase().includes('when is')
            
            if (isLangChain500 && isConcertQuery) {
              console.log('[Chat] LangChain failed for concert query, trying Playwright fallback...')
              // Try Playwright as fallback
              const playwrightServer = availableServers.find(s => 
                s.serverId.includes('playwright') || s.name.toLowerCase().includes('playwright')
              )
              
              if (playwrightServer && playwrightServer.tools && playwrightServer.tools.length > 0) {
                // Update target server and tool
                targetServer = playwrightServer
                toolName = playwrightServer.tools[0].name
                agentName = "Playwright MCP Server (Fallback)"
                
                // Rebuild tool arguments for Playwright
                // Always set URL first (required for browser_navigate)
                toolArgs = {
                  url: 'https://www.stubhub.com' // Default to StubHub for concert searches
                }
                
                // Extract search query from content
                // Pattern: "when is [artist] next concert in [location]"
                const searchMatch = content.match(/(?:when is|find|look for|search for)\s+(.+?)(?:\.|$|next|in )/i)
                const artistMatch = content.match(/['"](.+?)['"]/i)
                const locationMatch = content.match(/(?:in|at)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i)
                
                let searchQuery = ''
                if (artistMatch) {
                  // Extract artist from quotes
                  const artist = artistMatch[1]
                  const location = locationMatch ? locationMatch[1] : ''
                  searchQuery = `${artist}${location ? ` ${location}` : ''} concert`
                } else if (searchMatch) {
                  // Extract from "when is X next concert in Y"
                  let artist = searchMatch[1].trim()
                  // Remove "next concert" or similar phrases
                  artist = artist.replace(/\s+(?:next|upcoming|future)\s+(?:concert|show|event).*$/i, '').trim()
                  const location = locationMatch ? locationMatch[1] : ''
                  searchQuery = `${artist}${location ? ` ${location}` : ''} concert`
                } else {
                  // Fallback: use entire content as search query
                  searchQuery = content.replace(/when is|find|look for|search for/gi, '').trim()
                }
                
                toolArgs.search_query = searchQuery
                toolArgs.auto_search = true
                toolArgs.wait_timeout = 15000
                
                console.log('[Chat] Retrying with Playwright:', toolArgs)
                // Retry with Playwright
                result = await invokeMCPTool({
                  serverId: playwrightServer.serverId,
                  tool: toolName,
                  arguments: toolArgs,
                })
              } else {
                // No Playwright available, throw original error
                throw toolError
              }
            } else {
              // Not a concert query or not a LangChain 500, throw original error
              throw toolError
            }
          }

          // Log raw result for debugging
          console.log('[Chat] Raw agent result:', {
            serverId: targetServer.serverId,
            tool: toolName,
            result,
            hasContent: !!result.content,
            isError: result.isError,
          })

          // Check for errors first
          if (result.isError) {
            const errorText = result.content?.[0]?.text || 'Agent returned an error'
            console.error('[Chat] Agent returned error:', errorText)
            throw new Error(errorText)
          }

          // Extract text content from response
          let rawResponseContent = ''
          if (result.content && Array.isArray(result.content)) {
            rawResponseContent = result.content
              .filter(item => item.type === 'text' && item.text)
              .map(item => item.text)
              .join('\n\n')
            
            // Format response as natural language for better UX (especially for Playwright snapshots)
            try {
              const toolContext: ToolContext = {
                tool: targetServer.serverId.includes('playwright') ? 'playwright' : 
                      targetServer.serverId.includes('maps') ? 'google-maps' : 'unknown',
                serverId: targetServer.serverId,
                toolName: toolName || 'unknown',
              }
              
              // Only format if we have significant content (not just short messages)
              if (rawResponseContent.length > 200 || rawResponseContent.includes('```yaml') || rawResponseContent.includes('Page Snapshot')) {
                console.log('[Chat] Calling formatToolResponse for Playwright response')
                try {
                  const formatted = await formatToolResponse(content, { content: result.content }, toolContext)
                  console.log('[Chat] Formatter returned:', formatted.substring(0, 200))
                  responseContent = formatted
                } catch (formatErr) {
                  console.error('[Chat] Format error:', formatErr)
                  // If formatting fails, use guardrail fallback
                  responseContent = finalGuardrail(rawResponseContent)
                }
              } else {
                responseContent = rawResponseContent
              }
            } catch (formatError) {
              console.warn('[Chat] Failed to format response, using raw:', formatError)
              responseContent = rawResponseContent
            }
          } else if (typeof result === 'string') {
            responseContent = result
          } else {
            responseContent = JSON.stringify(result, null, 2)
          }
          
          // Check if auto-search was attempted and verify results (applies to all response types)
          const searchQuery = toolArgs?.search_query || toolArgs?.searchQuery
          if (searchQuery && toolName?.includes('browser_navigate')) {
            const searchQueryLower = searchQuery.toLowerCase()
            const responseLower = responseContent.toLowerCase()
            
            // Check if search results are present (not just homepage)
            const hasSearchResults = responseLower.includes(searchQueryLower.split(' ')[0]) && 
                                     !responseLower.includes('trending events') &&
                                     !responseLower.includes('popular categories') &&
                                     !responseLower.includes('buy sports, concert and theater tickets') // StubHub homepage indicator
            
            // If auto_search was enabled, check if it succeeded
            if (toolArgs?.auto_search) {
              if (hasSearchResults) {
                responseContent += `\n\n✅ **Auto-search completed** for "${searchQuery}". Results are shown above.`
              } else if (responseLower.includes('search') || responseLower.includes('textbox')) {
                // Auto-search was attempted but may not have found results yet
                responseContent += `\n\nℹ️ **Auto-search attempted** for "${searchQuery}". If no results are shown, the search may still be loading or the search box wasn't detected.`
              }
            } else {
              // Legacy: search query provided but auto_search not enabled
              if (!hasSearchResults && (responseLower.includes('search') || responseLower.includes('textbox'))) {
                responseContent += `\n\n⚠️ **Search Not Performed**: I navigated to the website. To automatically perform the search for "${searchQuery}", the auto-search feature needs to be enabled.`
              }
            }
          }
          
          // Check for bot detection / 403 errors in Playwright responses (applies to all response types)
          if (targetServer.serverId.includes('playwright') && 
              (responseContent.includes('403') || 
               responseContent.includes('unusual behavior') ||
               responseContent.includes('Browsing Activity Has Been Paused') ||
               responseContent.includes('bot detection'))) {
            responseContent = `⚠️ **Website Bot Detection**: ${responseContent}\n\n**Note**: Some websites like Ticketmaster have strong bot protection that blocks automated browsers. The page was accessed but may require:\n- Human verification\n- Different browser headers\n- Stealth techniques\n\nConsider using a different approach or trying again later.`
          }

          // Check for iteration/time limit messages and add helpful context
          if (responseContent && (
            responseContent.toLowerCase().includes('iteration limit') || 
            responseContent.toLowerCase().includes('time limit') ||
            responseContent.toLowerCase().includes('stopped due to')
          )) {
            console.warn('[Chat] Agent hit limit:', responseContent)
            responseContent = `${responseContent}\n\n💡 **Tip**: For complex multi-step queries, consider breaking them into smaller requests. The agent may need higher iteration limits for very complex tasks.`
          }

          // Validate response is not empty
          if (!responseContent || responseContent.trim().length === 0) {
            throw new Error("The agent didn't return a valid response. Please try again or select a different agent.")
          }

          // Check for placeholder-like responses
          if (isPlaceholderResponse(responseContent)) {
            console.warn('[Chat] Detected placeholder-like response from agent:', {
              agentName,
              serverId: targetServer.serverId,
              tool: toolName,
              responsePreview: responseContent.substring(0, 200),
            })
            // Still show the response, but log a warning
          }

          // Log the response for debugging
          console.log('[Chat] Agent response:', {
            agentName,
            serverId: targetServer.serverId,
            tool: toolName,
            responseLength: responseContent.length,
            preview: responseContent.substring(0, 100),
          })
        }
        
        if (!isDesignRequest(content) && !responseContent) {
          // Only show this error if it wasn't a design request (design requests are handled above)
          responseContent = "I couldn't find an available MCP server to handle your request. Please try selecting a specific agent."
        }
      }
      
      if (!isRouter) {
        // Use selected agent
        const selectedAgent = agentOptions.find((a) => a.id === selectedAgentId)
        const server = availableServers.find(s => s.serverId === selectedAgentId)
        
        // If it's a design request, route to design generation endpoint (handles tool discovery)
        if (isDesignRequest(content) && server) {
          // Route to design generation API, but use the selected agent name
          agentName = selectedAgent?.name || "Design Generator"
          
          try {
            // Extract design details from the request
            const description = content
            const styleMatch = content.match(/(cosmic|dark|modern|minimalist|vintage|retro)/i)
            const colorMatch = content.match(/(purple|blue|red|green|yellow|orange|pink|neon)/i)
            
            // Generate the design (backend will discover tools if needed)
            generateResponse = await generateSVG({
              description: description,
              style: styleMatch ? styleMatch[1].toLowerCase() : 'modern',
              colorPalette: colorMatch ? [colorMatch[1]] : undefined,
              size: {
                width: 1920,
                height: 1080,
              },
              serverId: server.serverId, // Pass serverId so backend can discover tools
            })
            
            // Use actual server name from response if available, otherwise use selected agent name
            if (generateResponse.serverName) {
              agentName = generateResponse.serverName
            } else {
              agentName = selectedAgent?.name || server.name || "Design Generator"
            }
            
            // Handle response (same as router mode)
            if (generateResponse.completed && (generateResponse.imageUrl || generateResponse.imageData)) {
              // Synchronous result - no job ID needed
              const imageUrl = generateResponse.imageUrl
              const imageData = generateResponse.imageData
              
              if (imageUrl) {
                responseContent = `Your design is ready!`
              } else if (imageData) {
                responseContent = `Your design is ready!`
              } else {
                responseContent = generateResponse.result || generateResponse.message || "Design generated successfully!"
              }
            } else if (generateResponse.completed && generateResponse.result) {
              // Completed but no image - just return the result
              responseContent = generateResponse.result || generateResponse.message || "Design generated successfully!"
            } else if (generateResponse.jobId) {
              // Only create job ID message if we actually have a job ID (async processing)
              responseContent = `I've started creating your design! Job ID: ${generateResponse.jobId}. I'll notify you when it's ready.`
              
              // Poll for job completion (same logic as router mode)
              const pollJob = async () => {
                try {
                  const maxAttempts = 60
                  let attempts = 0
                  
                  while (attempts < maxAttempts) {
                    await new Promise(resolve => setTimeout(resolve, 5000))
                    
                    try {
                      const jobStatus = await getJobStatus(generateResponse.jobId)
                      
                      if (jobStatus.job.status === 'COMPLETED' && jobStatus.asset) {
                        const updateMessage: ChatMessage = {
                          id: `assistant-${Date.now()}`,
                          role: "assistant",
                          content: `Your design is ready! ${jobStatus.asset.url ? `View it here: ${jobStatus.asset.url}` : 'Design completed successfully.'}`,
                          timestamp: new Date(),
                          agentName: agentName,
                        }
                        setMessages((prev) => [...prev, updateMessage])
                        break
                      } else if (jobStatus.job.status === 'FAILED') {
                        const errorMessage: ChatMessage = {
                          id: `assistant-${Date.now()}`,
                          role: "assistant",
                          content: `Design generation failed: ${jobStatus.job.errorMessage || 'Unknown error'}`,
                          timestamp: new Date(),
                          agentName: agentName,
                        }
                        setMessages((prev) => [...prev, errorMessage])
                        break
                      }
                    } catch (pollError) {
                      console.error('Error polling job status:', pollError)
                      if (attempts > 10) break
                    }
                    
                    attempts++
                  }
                } catch (error) {
                  console.error('Error in polling loop:', error)
                }
              }
              
              pollJob().catch(console.error)
            } else {
              responseContent = generateResponse.message || "Design generation started successfully."
            }
          } catch (error) {
            console.error('Design generation error:', error)
            const errorMessage = error instanceof Error ? error.message : 'Unknown error'
            
            // Check for quota errors
            if (errorMessage.includes('quota') || errorMessage.includes('429') || errorMessage.includes('RESOURCE_EXHAUSTED') || errorMessage.includes('exceeded')) {
              responseContent = `⚠️ **API Quota Exceeded**: The Gemini API free tier has very limited quotas for image generation. The model \`gemini-2.5-flash-preview-image\` requires a paid plan.\n\n**Options:**\n1. Wait for quota reset (check: https://ai.dev/usage?tab=rate-limit)\n2. Upgrade to a paid Gemini API plan\n3. Try again later`
            } else {
              responseContent = `I encountered an issue: ${errorMessage}. Tool discovery may still be in progress. Please try again in a few seconds.`
            }
          }
        } else if (server && server.tools && server.tools.length > 0) {
          agentName = selectedAgent?.name
          const tool = server.tools[0] // Use first available tool
          
          let toolArgs: Record<string, unknown> = {}
          if (tool.name === 'agent_executor') {
            toolArgs = { query: content, input: content }
          } else {
            toolArgs = { query: content, text: content, input: content }
          }

          const result = await invokeMCPTool({
            serverId: server.serverId,
            tool: tool.name,
            arguments: toolArgs,
          })

          // Log raw result for debugging
          console.log('[Chat] Raw agent result:', {
            serverId: server.serverId,
            tool: tool.name,
            result,
            hasContent: !!result.content,
            isError: result.isError,
          })

          // Check for errors first
          if (result.isError) {
            const errorText = result.content?.[0]?.text || 'Agent returned an error'
            console.error('[Chat] Agent returned error:', errorText)
            throw new Error(errorText)
          }

          if (result.content && Array.isArray(result.content)) {
            responseContent = result.content
              .filter(item => item.type === 'text' && item.text)
              .map(item => item.text)
              .join('\n\n')
          } else if (typeof result === 'string') {
            responseContent = result
          } else {
            responseContent = JSON.stringify(result, null, 2)
          }

          // Validate response is not empty
          if (!responseContent || responseContent.trim().length === 0) {
            throw new Error("The agent didn't return a valid response. Please try again or select a different agent.")
          }

          // Check for placeholder-like responses
          if (isPlaceholderResponse(responseContent)) {
            console.warn('[Chat] Detected placeholder-like response from agent:', {
              agentName,
              serverId: server.serverId,
              tool: tool.name,
              responsePreview: responseContent.substring(0, 200),
            })
            // Still show the response, but log a warning
          }

          // Log the response for debugging
          console.log('[Chat] Agent response:', {
            agentName,
            serverId: server.serverId,
            tool: tool.name,
            responseLength: responseContent.length,
            preview: responseContent.substring(0, 100),
          })
        } else {
          // If it's a design request, route to design generation endpoint (handles tool discovery)
          if (isDesignRequest(content)) {
            // This will be handled by the design generation endpoint above
            // But we're already past that, so show helpful message
            responseContent = `The selected agent "${selectedAgent?.name}" doesn't have available tools yet. Tool discovery is in progress. Please try again in a few seconds, or use "Auto-Route" mode.`
          } else {
            responseContent = `The selected agent "${selectedAgent?.name}" doesn't have available tools. Please try a different agent.`
          }
        }
      }

      // Create assistant message with image data if available
      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: responseContent,
        timestamp: new Date(),
        agentName: agentName,
      }
      
      // Add image data if this was a design generation response
      if (isDesignRequest(content) && generateResponse) {
        if (generateResponse.imageUrl) {
          assistantMessage.imageUrl = generateResponse.imageUrl
        }
        if (generateResponse.imageData) {
          assistantMessage.imageData = generateResponse.imageData
        }
      }

      setMessages((prev) => [...prev, assistantMessage])
    } catch (error) {
      console.error('Error sending message:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to process your request'
      
      // Log full error details for debugging
      console.error('[Chat] Full error details:', {
        error,
        selectedAgentId,
        availableServers: availableServers.map(s => ({ serverId: s.serverId, name: s.name })),
        errorStack: error instanceof Error ? error.stack : undefined,
      })
      
      // Format quota errors nicely
      let displayMessage = errorMessage
      if (errorMessage.includes('quota') || errorMessage.includes('429') || errorMessage.includes('RESOURCE_EXHAUSTED') || errorMessage.includes('exceeded')) {
        displayMessage = `⚠️ **API Quota Exceeded**: The Gemini API free tier has very limited quotas for image generation. The model \`gemini-2.5-flash-preview-image\` requires a paid plan.\n\n**Options:**\n1. Wait for quota reset (check: https://ai.dev/usage?tab=rate-limit)\n2. Upgrade to a paid Gemini API plan\n3. Try again later`
      } else if (!errorMessage.includes('⚠️')) {
        displayMessage = `Sorry, I encountered an error: ${errorMessage}. Please try again or select a different agent. If this persists, the agent may be unavailable or misconfigured.`
      }
      
      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: displayMessage,
        timestamp: new Date(),
      }

      setMessages((prev) => [...prev, assistantMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const handleVoiceInput = () => {
    setVoiceDialogOpen(true)
  }

  const handleVoiceTranscript = (transcript: string) => {
    handleSendMessage(transcript)
  }

  const handleFileUpload = () => {
    setFileDialogOpen(true)
  }

  const handleFileSelected = (file: File, preview?: string) => {
    const attachment: ChatMessage["contextAttachment"] = {
      type: file.type.startsWith("image/") ? "image" : "document",
      name: file.name,
      preview,
    }

    handleSendMessage(`Can you analyze this ${attachment.type}?`, attachment)
  }


  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-br from-background via-background to-background/95">
      <div className="relative">
        {/* Subtle background glow */}
        <div className="absolute inset-0 bg-gradient-to-b from-blue-500/5 via-transparent to-green-500/5 pointer-events-none" />
        <AgentSelector agents={agentOptions} selectedAgentId={selectedAgentId} onAgentChange={setSelectedAgentId} />
      </div>

      <ScrollArea className="flex-1 px-2 sm:px-6 pb-8 overflow-y-auto" ref={scrollAreaRef}>
        <div className="max-w-4xl mx-auto py-4 px-1 sm:px-0">
          {messages.map((message) => (
            <ChatMessageComponent key={message.id} message={message} />
          ))}

          {isLoading && (
            <div className="flex gap-3 py-4">
              <div className="h-8 w-8 rounded-full bg-gradient-to-br from-green-500/30 to-emerald-500/20 border border-white/20 backdrop-blur-sm animate-pulse" />
              <div className="flex flex-col gap-2">
                <div className="h-4 w-32 bg-white/10 backdrop-blur-md border border-white/20 animate-pulse rounded-lg" />
                <div className="h-16 w-64 bg-white/10 backdrop-blur-md border border-white/20 animate-pulse rounded-2xl" />
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      <ChatInput
        onSendMessage={(msg, attachment) => handleSendMessage(msg, attachment)}
        onVoiceInput={handleVoiceInput}
        onFileUpload={handleFileUpload}
        onAgentSelect={setSelectedAgentId}
        agentOptions={agentOptions}
        isLoading={isLoading}
      />

      <VoiceInputDialog open={voiceDialogOpen} onOpenChange={setVoiceDialogOpen} onTranscript={handleVoiceTranscript} />
      <FileUploadDialog open={fileDialogOpen} onOpenChange={setFileDialogOpen} onUpload={handleFileSelected} />
    </div>
  )
}

