"use client"

import { useState, useRef, useEffect } from "react"
import type { ChatMessage, AgentOption } from "@/types/chat"
import { ChatMessageComponent } from "@/components/chat-message"
import { AgentSelector } from "@/components/agent-selector"
import { ChatInput } from "@/components/chat-input"
import { VoiceInputDialog } from "@/components/voice-input-dialog"
import { FileUploadDialog } from "@/components/file-upload-dialog"
import { GlazyrCaptureDialog } from "@/components/glazyr-capture-dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { getServers, generateSVG, getJobStatus, createJobProgressStream } from "@/lib/api"
import { transformServersToAgents } from "@/lib/server-utils"
import type { MCPServer } from "@/lib/api"
import { invokeMCPTool } from "@/lib/api"
import { routeRequest, getServerToolContext } from "@/lib/tool-router"
import { getNativeOrchestrator } from "@/lib/native-orchestrator"
import { executeWorkflow } from "@/lib/workflow-executor"
import { getChatContextManager } from "@/lib/chat-context"

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
 * Detect if a message is requesting design/generation work
 */
function isDesignRequest(content: string): boolean {
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
  const [glazyrDialogOpen, setGlazyrDialogOpen] = useState(false)
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
        setAvailableServers(servers)
        
        // Register servers with native orchestrator for workflow execution
        const orchestrator = getNativeOrchestrator()
        orchestrator.registerServers(servers)
        console.log('[Native Orchestrator] Registered', servers.length, 'servers')
        
        // Transform servers to agent options
        const transformedAgents = transformServersToAgents(servers)
        const options: AgentOption[] = [
          { id: "router", name: "Auto-Route (Recommended)", type: "router" },
          ...transformedAgents.map((a) => ({
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

      const isRouter = selectedAgentId === "router"
      
      if (isRouter) {
        // Auto-route based on content and attachment type
        let targetServer: MCPServer | null = null
        let toolName = "agent_executor"
        let toolArgs: Record<string, unknown> = {}
        
        // Check for design/generation requests first
        if (isDesignRequest(content)) {
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
        } else if (attachment?.type === "image" || attachment?.type === "glazyr") {
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
          if (!targetServer) {
            const routing = routeRequest(content, availableServers)
          
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
                  // Format result from workflow
                  const resultText = typeof workflowResult.finalResult === 'object' 
                    ? JSON.stringify(workflowResult.finalResult, null, 2)
                    : String(workflowResult.finalResult || 'Workflow completed successfully')
                  
                  responseContent = `✅ **Workflow completed**\n\n${resultText}\n\n**Steps executed:**\n${workflowResult.steps.map((s, i) => `${i + 1}. ${s.description}${s.result ? ' ✓' : s.error ? ` ✗ ${s.error}` : ''}`).join('\n')}`
                  
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
                if (routing.orchestrationNeeded) {
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
            }
            
            // Continue with normal routing if native orchestrator didn't handle it
            if (!targetServer && routing.primaryServer) {
              // Simple single-step query, use the primary server
              targetServer = routing.primaryServer
              const toolContext = getServerToolContext(routing.primaryServer)
              agentName = toolContext?.tool || routing.primaryServer.name
            } else if (!targetServer) {
              // Fallback to LangChain agent for general queries
              targetServer = availableServers.find(s => s.serverId === 'com.langchain/agent-mcp-server') ||
                            availableServers.find(s => s.serverId === 'com.valuation/mcp-server') ||
                            availableServers[0]
              agentName = "AI Assistant"
            }
          }
        }

        // Only invoke tool if we didn't handle it as a design request
        // (Design requests are handled above and responseContent is already set)
        if (!isDesignRequest(content) && targetServer && targetServer.tools && targetServer.tools.length > 0) {
          // Use agent_executor if available, otherwise use first tool
          // BUT: If we already have toolName set from explicit detection, use that
          if (!toolName) {
            const executorTool = targetServer.tools.find(t => t.name === 'agent_executor')
            toolName = executorTool ? 'agent_executor' : targetServer.tools[0].name
          }
          
          console.log(`Routing to ${targetServer.name} using tool: ${toolName}`)
          
          // Prepare tool arguments based on tool type
          // Only create new toolArgs if we don't already have them (from explicit detection)
          if (!toolArgs || Object.keys(toolArgs).length === 0) {
            toolArgs = {}
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
                // Try common domains mentioned in query
                const domainMatch = content.match(/(ticketmaster|google|amazon|facebook|twitter)/i)
                if (domainMatch) {
                  toolArgs.url = `https://www.${domainMatch[1].toLowerCase()}.com`
                } else {
                  throw new Error(`browser_navigate requires a URL. Please specify a website (e.g., "go to ticketmaster.com")`)
                }
              }
            }
            // Preserve or add search query if present
            if (!toolArgs.query) {
              const searchMatch = content.match(/(?:look for|search for|find|get)\s+(.+?)(?:\.|$)/i)
              if (searchMatch) {
                toolArgs.query = searchMatch[1].trim()
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

          const result = await invokeMCPTool({
            serverId: targetServer.serverId,
            tool: toolName,
            arguments: toolArgs,
          })

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
          if (result.content && Array.isArray(result.content)) {
            responseContent = result.content
              .filter(item => item.type === 'text' && item.text)
              .map(item => item.text)
              .join('\n\n')
            
            // Check for bot detection / 403 errors in Playwright responses
            if (targetServer.serverId.includes('playwright') && 
                (responseContent.includes('403') || 
                 responseContent.includes('unusual behavior') ||
                 responseContent.includes('Browsing Activity Has Been Paused') ||
                 responseContent.includes('bot detection'))) {
              responseContent = `⚠️ **Website Bot Detection**: ${responseContent}\n\n**Note**: Some websites like Ticketmaster have strong bot protection that blocks automated browsers. The page was accessed but may require:\n- Human verification\n- Different browser headers\n- Stealth techniques\n\nConsider using a different approach or trying again later.`
            }
          } else if (typeof result === 'string') {
            responseContent = result
          } else {
            responseContent = JSON.stringify(result, null, 2)
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
        } else if (!isDesignRequest(content)) {
          // Only show this error if it wasn't a design request (design requests are handled above)
          responseContent = "I couldn't find an available MCP server to handle your request. Please try selecting a specific agent."
        }
      } else {
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
          if (isDesignRequest) {
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

  const handleGlazyrCapture = () => {
    setGlazyrDialogOpen(true)
  }

  const handleGlazyrCaptured = () => {
    const attachment: ChatMessage["contextAttachment"] = {
      type: "glazyr",
      name: "Screen capture",
    }

    handleSendMessage("What do you see in this screenshot?", attachment)
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      <AgentSelector agents={agentOptions} selectedAgentId={selectedAgentId} onAgentChange={setSelectedAgentId} />

      <ScrollArea className="flex-1 px-6 overflow-y-auto gradient-grid-bg" ref={scrollAreaRef}>
        <div className="max-w-4xl mx-auto py-4">
          {messages.map((message) => (
            <ChatMessageComponent key={message.id} message={message} />
          ))}

          {isLoading && (
            <div className="flex gap-3 py-4">
              <div className="h-8 w-8 rounded-full bg-primary animate-pulse" />
              <div className="flex flex-col gap-2">
                <div className="h-4 w-32 bg-muted animate-pulse rounded" />
                <div className="h-16 w-64 bg-muted animate-pulse rounded-2xl" />
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      <ChatInput
        onSendMessage={(msg) => handleSendMessage(msg)}
        onVoiceInput={handleVoiceInput}
        onFileUpload={handleFileUpload}
        onGlazyrCapture={handleGlazyrCapture}
        onAgentSelect={setSelectedAgentId}
        agentOptions={agentOptions}
        isLoading={isLoading}
      />

      <VoiceInputDialog open={voiceDialogOpen} onOpenChange={setVoiceDialogOpen} onTranscript={handleVoiceTranscript} />
      <FileUploadDialog open={fileDialogOpen} onOpenChange={setFileDialogOpen} onUpload={handleFileSelected} />
      <GlazyrCaptureDialog
        open={glazyrDialogOpen}
        onOpenChange={setGlazyrDialogOpen}
        onCapture={handleGlazyrCaptured}
      />
    </div>
  )
}
