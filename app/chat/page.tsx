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
import { getServers, invokeMCPTool, generateSVG, getJobStatus, createJobProgressStream, analyzeDocument } from "@/lib/api"
import { transformServersToAgents } from "@/lib/server-utils"
import { parseToolParameters, selectTool } from "@/lib/tool-parser"
import { routeToAgent } from "@/lib/agent-router"
import { useToast } from "@/hooks/use-toast"

// Agent options will be loaded from backend
const defaultAgentOptions: AgentOption[] = [
  { id: "router", name: "Auto-Route (Recommended)", type: "router" },
]

const initialMessages: ChatMessage[] = [
  {
    id: "1",
    role: "assistant",
    content:
      "Hello! I'm your MCP assistant. I can help you with vision analysis, data processing, document analysis, and more. How can I assist you today?",
    timestamp: new Date(Date.now() - 1000 * 60 * 5),
    // audioUrl: undefined, // TTS not implemented yet
  },
]

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages)
  const [agentOptions, setAgentOptions] = useState<AgentOption[]>(defaultAgentOptions)
  const [agents, setAgents] = useState<ReturnType<typeof transformServersToAgents>>([])
  const [selectedAgentId, setSelectedAgentId] = useState("router")
  const [isLoading, setIsLoading] = useState(false)
  const [voiceDialogOpen, setVoiceDialogOpen] = useState(false)
  const [fileDialogOpen, setFileDialogOpen] = useState(false)
  const [glazyrDialogOpen, setGlazyrDialogOpen] = useState(false)
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const { toast } = useToast()
  // Track routing history for consistency
  const routingHistoryRef = useRef<Map<string, { success: boolean; agentId: string }>>(new Map())

  // Load agents from backend
  useEffect(() => {
    async function loadAgents() {
      try {
        const servers = await getServers()
        console.log('Raw servers from backend:', servers)
        
        // Filter out empty or invalid servers
        const validServers = servers.filter((s) => s && s.serverId && s.name)
        console.log('Valid servers after filtering:', validServers)
        
        if (validServers.length === 0) {
          console.warn('No valid servers found in backend response')
          return
        }
        
        const transformedAgents = transformServersToAgents(validServers)
        console.log('Transformed agents:', transformedAgents)
        setAgents(transformedAgents)
        const options: AgentOption[] = [
          { id: "router", name: "Auto-Route (Recommended)", type: "router" },
          ...transformedAgents
            .filter((a) => {
              // Include STDIO servers (stdio:// prefix) - backend handles them
              const isStdio = a.endpoint?.startsWith('stdio://')
              // Include HTTP servers with proper endpoints
              const hasHttpEndpoint = a.endpoint && !a.endpoint.startsWith('stdio://') && a.endpoint !== a.id
              return a.status === "online" && (isStdio || hasHttpEndpoint)
            })
            .map((a) => ({
              id: a.id,
              name: a.name,
              type: "agent" as const,
            })),
        ]
        setAgentOptions(options)
      } catch (error) {
        console.error('Failed to load agents:', error)
        // Keep default options on error
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
      const selectedAgent = agentOptions.find((a) => a.id === selectedAgentId)
      const isRouter = selectedAgentId === "router"
      
      // Check if this is an SVG generation request
      const isSVGRequest = content.toLowerCase().includes('svg') || 
                          content.toLowerCase().includes('generate') ||
                          content.toLowerCase().includes('create') ||
                          content.toLowerCase().includes('make') ||
                          content.toLowerCase().includes('design') ||
                          content.toLowerCase().includes('icon') ||
                          content.toLowerCase().includes('logo') ||
                          content.toLowerCase().includes('picture')

      if (isSVGRequest && !attachment) {
        // Handle SVG generation
        try {
          const result = await generateSVG({
            description: content,
          })

          // Add loading message
          const loadingMessage: ChatMessage = {
            id: `loading-${Date.now()}`,
            role: "assistant",
            content: "Generating SVG... This may take a moment.",
            timestamp: new Date(),
            agentName: "MCP Server",
          }
          setMessages((prev) => [...prev, loadingMessage])

          // Set up progress streaming via SSE
          const eventSource = createJobProgressStream(result.jobId)
          
          // Handle different event types from SSE
          eventSource.addEventListener('status', (event: MessageEvent) => {
            try {
              const data = JSON.parse(event.data)
              setMessages((prev) => 
                prev.map((msg) => 
                  msg.id === loadingMessage.id
                    ? {
                        ...msg,
                        content: data.progressMessage || `Status: ${data.status}`,
                      }
                    : msg
                )
              )
            } catch (e) {
              console.error('Error parsing status event:', e)
            }
          })

          eventSource.addEventListener('progress', (event: MessageEvent) => {
            try {
              const data = JSON.parse(event.data)
              setMessages((prev) => 
                prev.map((msg) => 
                  msg.id === loadingMessage.id
                    ? {
                        ...msg,
                        content: data.progressMessage || `Generating... ${data.progress}%`,
                      }
                    : msg
                )
              )
            } catch (e) {
              console.error('Error parsing progress event:', e)
            }
          })

          eventSource.addEventListener('complete', (event: MessageEvent) => {
            eventSource.close()
            try {
              const data = JSON.parse(event.data)
              const svgContent = data.data?.asset?.content || data.asset?.content || ''
              
              setMessages((prev) => 
                prev.map((msg) => 
                  msg.id === loadingMessage.id
                    ? {
                        ...msg,
                        content: svgContent 
                          ? `Here's your generated SVG:\n\n\`\`\`svg\n${svgContent}\n\`\`\``
                          : `SVG generation completed!`,
                      }
                    : msg
                )
              )
            } catch (e) {
              console.error('Error parsing complete event:', e)
              // Fallback: fetch job status
              getJobStatus(result.jobId).then((jobData) => {
                const svgContent = jobData.asset?.content || ''
                setMessages((prev) => 
                  prev.map((msg) => 
                    msg.id === loadingMessage.id
                      ? {
                          ...msg,
                          content: svgContent 
                            ? `Here's your generated SVG:\n\n\`\`\`svg\n${svgContent}\n\`\`\``
                            : `SVG generation completed!`,
                        }
                      : msg
                  )
                )
              })
            }
            setIsLoading(false)
          })

          eventSource.addEventListener('error', (event: MessageEvent) => {
            eventSource.close()
            try {
              const data = JSON.parse(event.data)
              setMessages((prev) => 
                prev.map((msg) => 
                  msg.id === loadingMessage.id
                    ? {
                        ...msg,
                        content: `Error: ${data.error || 'SVG generation failed'}`,
                      }
                    : msg
                )
              )
            } catch (e) {
              setMessages((prev) => 
                prev.map((msg) => 
                  msg.id === loadingMessage.id
                    ? {
                        ...msg,
                        content: `Error: SVG generation failed`,
                      }
                    : msg
                )
              )
            }
            setIsLoading(false)
          })

          // Fallback: if SSE connection fails, poll for job status
          eventSource.onerror = () => {
            console.warn('SSE connection error, falling back to polling')
            eventSource.close()
            
            // Poll for job status
            const pollInterval = setInterval(async () => {
              try {
                const jobData = await getJobStatus(result.jobId)
                
                if (jobData.job.status === 'COMPLETED' || jobData.job.status === 'FAILED') {
                  clearInterval(pollInterval)
                  const svgContent = jobData.asset?.content || ''
                  
                  setMessages((prev) => 
                    prev.map((msg) => 
                      msg.id === loadingMessage.id
                        ? {
                            ...msg,
                            content: svgContent 
                              ? `Here's your generated SVG:\n\n\`\`\`svg\n${svgContent}\n\`\`\``
                              : jobData.job.status === 'FAILED'
                                ? `Error: ${jobData.job.errorMessage || 'Generation failed'}`
                                : `SVG generation completed!`,
                          }
                        : msg
                    )
                  )
                  setIsLoading(false)
                } else {
                  // Update progress
                  setMessages((prev) => 
                    prev.map((msg) => 
                      msg.id === loadingMessage.id
                        ? {
                            ...msg,
                            content: jobData.job.progressMessage || `Generating... ${jobData.job.progress}%`,
                          }
                        : msg
                    )
                  )
                }
              } catch (error) {
                console.error('Error polling job status:', error)
                clearInterval(pollInterval)
                setIsLoading(false)
              }
            }, 2000) // Poll every 2 seconds

            // Stop polling after 60 seconds
            setTimeout(() => {
              clearInterval(pollInterval)
              setIsLoading(false)
            }, 60000)
          }
        } catch (error) {
          console.error('SVG generation error:', error)
          const errorMessage: ChatMessage = {
            id: `error-${Date.now()}`,
            role: "assistant",
            content: `Sorry, I encountered an error generating the SVG: ${error instanceof Error ? error.message : 'Unknown error'}`,
            timestamp: new Date(),
            agentName: "MCP Server",
          }
          setMessages((prev) => [...prev, errorMessage])
          setIsLoading(false)
          toast({
            title: "Generation failed",
            description: error instanceof Error ? error.message : "Unknown error",
            variant: "destructive",
          })
        }
      } else if (!isRouter && selectedAgent && selectedAgent.type === "agent") {
        // Handle MCP agent invocation
        try {
          const agent = agents.find((a) => a.id === selectedAgentId)
          if (!agent) {
            throw new Error(`Agent ${selectedAgent.name} (ID: ${selectedAgentId}) not found in agents list. Available agents: ${agents.map(a => a.id).join(', ')}`)
          }
          
          // Check if this is a STDIO-based server (endpoint starts with "stdio://")
          const isStdioServer = agent.endpoint && agent.endpoint.startsWith('stdio://')
          
          // Only HTTP-based servers need endpoint URLs
          if (!isStdioServer && (!agent.endpoint || agent.endpoint.trim() === '' || agent.endpoint === agent.id)) {
            // If endpoint is missing or equals serverId (fallback), provide helpful error
            const errorMsg = agent.endpoint === agent.id
              ? `Agent "${selectedAgent.name}" is missing an endpoint URL. For STDIO-based servers (like Playwright), ensure your backend is deployed on a platform that supports long-running processes (Railway, Render, Fly.io). For HTTP-based servers, please edit the agent in the Registry page and add the endpoint (e.g., https://your-service.com/mcp). See PLAYWRIGHT_DEPLOYMENT.md for details.`
              : `Agent "${selectedAgent.name}" does not have a valid endpoint configured. Please edit the agent and add an endpoint URL.`
            
            throw new Error(errorMsg)
          }

          // Add loading message
          const loadingMessage: ChatMessage = {
            id: `loading-${Date.now()}`,
            role: "assistant",
            content: `Processing your request with ${selectedAgent.name}...`,
            timestamp: new Date(),
            agentName: selectedAgent.name,
          }
          setMessages((prev) => [...prev, loadingMessage])

          // Parse agent manifest to find available tools
          let manifestData: any = {}
          try {
            manifestData = agent.manifest ? JSON.parse(agent.manifest) : {}
          } catch (e) {
            console.error('Failed to parse agent manifest:', e)
          }

          // Get available tools from manifest
          const tools = manifestData.tools || []
          
          if (tools.length === 0) {
            throw new Error(`No tools available for agent ${selectedAgent.name}`)
          }

          // Extract API key early (needed for all tool invocations)
          const apiKey = manifestData.metadata?.apiKey || agent.manifest ? 
            (() => {
              try {
                const m = JSON.parse(agent.manifest)
                return m.metadata?.apiKey
              } catch {
                return undefined
              }
            })() : undefined

          // For Playwright and other MCP servers, intelligently select and parse tools
          // Otherwise, use the old agent_executor pattern
          let selectedTool = tools.find((t: any) => t.name === "agent_executor") || tools[0]
          
          // Build tool arguments based on the tool's input schema
          let toolArguments: Record<string, any> = {}
          
          // Check the tool's input schema to determine the correct parameter name
          if (selectedTool.inputSchema && selectedTool.inputSchema.properties) {
            const properties = selectedTool.inputSchema.properties as Record<string, any>
            const required = selectedTool.inputSchema.required || []
            
            // Find the first string property that seems to be the main input
            // Common names: "input", "query", "prompt", "text", "message"
            const inputParamNames = ['input', 'query', 'prompt', 'text', 'message']
            let foundParam: string | null = null
            
            for (const paramName of inputParamNames) {
              if (properties[paramName] && properties[paramName].type === 'string') {
                foundParam = paramName
                break
              }
            }
            
            // If no common name found, use the first required string property
            if (!foundParam && required.length > 0) {
              const firstRequired = required[0]
              if (properties[firstRequired] && properties[firstRequired].type === 'string') {
                foundParam = firstRequired
              }
            }
            
            // Fallback to "input" for agent_executor, "query" for others
            if (!foundParam) {
              foundParam = selectedTool.name === "agent_executor" ? "input" : "query"
            }
            
            toolArguments[foundParam] = content
          } else {
            // Fallback: use "input" for agent_executor, "query" for others
            toolArguments[selectedTool.name === "agent_executor" ? "input" : "query"] = content
          }
          
          // Add attachment if present
          if (attachment) {
            toolArguments.attachment = attachment
          }

          // If this looks like a Playwright-style MCP server (has browser_ tools)
          const hasBrowserTools = tools.some((t: any) => t.name?.startsWith('browser_'))
          if (hasBrowserTools) {
            // Intelligently select the right tool based on user message
            const toolName = selectTool(content, tools.map((t: any) => ({
              name: t.name,
              description: t.description || '',
            })))
            
            if (toolName) {
              selectedTool = tools.find((t: any) => t.name === toolName) || selectedTool
              
              // Parse parameters from natural language
              if (selectedTool.inputSchema) {
                const parsedParams = parseToolParameters(
                  content,
                  selectedTool.name,
                  selectedTool.inputSchema
                )
                
                // Merge parsed params with defaults
                toolArguments = {
                  ...parsedParams,
                  // Keep query for fallback
                  ...(Object.keys(parsedParams).length === 0 && { query: content }),
                }
              }
            }
            
            // If user wants to navigate AND take screenshot, we need to do it in sequence
            // Also handle cases like "take a screenshot of google.com" where URL is implicit
            // Note: apiKey is already defined above
            const lowerContent = content.toLowerCase()
            const wantsScreenshot = lowerContent.includes('screenshot') || 
                                    lowerContent.includes('capture') ||
                                    lowerContent.includes('picture') ||
                                    lowerContent.includes('snap')
            // More flexible navigation detection (handles typos like "avigate")
            const wantsNavigate = lowerContent.includes('navigate') ||
                                 lowerContent.includes('avigate') || // Handle typo
                                 lowerContent.includes('go to') ||
                                 lowerContent.includes('goto') ||
                                 lowerContent.includes('visit') ||
                                 lowerContent.includes('open') ||
                                 /https?:\/\/[^\s]+/i.test(content) // Has URL
            
            // Extract URL from message (supports both explicit URLs and domain names)
            // Pattern 1: Full URLs (https://example.com)
            let urlMatch = content.match(/https?:\/\/[^\s]+/i)
            
            // Pattern 2: Explicit navigation phrases (go to google.com, navigate to example.org)
            if (!urlMatch) {
              urlMatch = content.match(/(?:go to|navigate to|visit|open|avigate to)\s+([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i)
            }
            
            // Pattern 3: Implicit domain in screenshot requests (take screenshot of google.com)
            if (!urlMatch) {
              urlMatch = content.match(/(?:screenshot|capture|picture)\s+(?:of|from)\s+([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i)
            }
            
            // Pattern 4: Any domain-like string (google.com, example.org)
            if (!urlMatch) {
              urlMatch = content.match(/\b([a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}\b/i)
            }
            const hasUrl = !!urlMatch
            
            // If user wants screenshot AND there's a URL in the message, treat as navigate + screenshot
            // Examples: "take a screenshot of google.com", "screenshot https://example.com", 
            // "navigate to google.com and take screenshot"
            if (wantsScreenshot && (wantsNavigate || hasUrl)) {
              // This is a multi-step operation - we'll handle it sequentially
              // First navigate, then wait, then screenshot
              // The screenshot tool doesn't take a URL parameter - it screenshots the current page
              const navigateTool = tools.find((t: any) => t.name === 'browser_navigate')
              const screenshotTool = tools.find((t: any) => t.name === 'browser_take_screenshot')
              
              console.log('Multi-step operation detected:', { wantsNavigate, wantsScreenshot, hasNavigateTool: !!navigateTool, hasScreenshotTool: !!screenshotTool })
              
              if (navigateTool && screenshotTool) {
                // Extract URL - urlMatch was already computed above
                let url = null
                
                if (urlMatch) {
                  // If it's a full URL (starts with http), use it directly
                  const matchedText = urlMatch[0]
                  if (matchedText.startsWith('http')) {
                    url = matchedText
                  } else {
                    // Extract domain from match (could be in urlMatch[1] for capture groups)
                    const domain = urlMatch[1] || urlMatch[0]
                    // Clean up domain (remove trailing punctuation, etc.)
                    const cleanDomain = domain.replace(/[.,;!?]+$/, '').trim()
                    url = cleanDomain.startsWith('http') ? cleanDomain : `https://${cleanDomain}`
                  }
                }
                
                console.log('Extracted URL:', url)
                
                if (url) {
                  // Step 1: Navigate
                  try {
                    console.log('Step 1: Navigating to', url)
                    await invokeMCPTool({
                      serverId: agent.id,
                      tool: 'browser_navigate',
                      arguments: { url },
                      apiKey,
                    })
                    
                    // Update UI to show navigation completed
                    setMessages((prev) =>
                      prev.map((msg) =>
                        msg.id === loadingMessage.id
                          ? {
                              ...msg,
                              content: `Navigated to ${url}. Waiting for page to load...`,
                            }
                          : msg
                      )
                    )
                    
                    // Step 2: Wait for page to load (Playwright doesn't have browser_wait_for, so use timeout)
                    console.log('Step 2: Waiting 3 seconds for page to load...')
                    await new Promise(resolve => setTimeout(resolve, 3000))
                    
                    // Step 3: Take screenshot
                    console.log('Step 3: Taking screenshot...')
                    const screenshotResult = await invokeMCPTool({
                      serverId: agent.id,
                      tool: 'browser_take_screenshot',
                      arguments: { type: 'png', fullPage: false },
                      apiKey,
                    })
                    
                    console.log('Screenshot result:', screenshotResult)
                    
                    // Extract image from screenshot result
                    const textParts: string[] = []
                    let imageAttachment: ChatMessage["contextAttachment"] | undefined = undefined
                    
                    for (const contentItem of screenshotResult.content || []) {
                      if (contentItem.type === 'image' && contentItem.data) {
                        const mimeType = contentItem.mimeType || 'image/png'
                        const imageDataUrl = `data:${mimeType};base64,${contentItem.data}`
                        imageAttachment = {
                          type: 'image',
                          url: imageDataUrl,
                          name: 'Screenshot',
                        }
                        console.log('Found image attachment:', { mimeType, hasData: !!contentItem.data })
                      } else if (contentItem.type === 'text' && contentItem.text) {
                        textParts.push(contentItem.text)
                      } else if (typeof contentItem === 'string') {
                        textParts.push(contentItem)
                      }
                    }
                    
                    const responseText = textParts.join('\n\n') || 'Screenshot captured successfully!'
                    
                    console.log('Final result:', { hasImage: !!imageAttachment, responseText })
                    
                    setMessages((prev) =>
                      prev.map((msg) =>
                        msg.id === loadingMessage.id
                          ? {
                              ...msg,
                              content: `Navigated to ${url} and captured screenshot.\n\n${responseText}`,
                              ...(imageAttachment && { contextAttachment: imageAttachment }),
                            }
                          : msg
                      )
                    )
                    setIsLoading(false)
                    return // Exit early since we handled it
                  } catch (error) {
                    console.error('Multi-step operation error:', error)
                    // Fall through to single tool invocation
                  }
                } else {
                  console.warn('Could not extract URL from message:', content)
                }
              } else {
                console.warn('Missing required tools:', { navigateTool: !!navigateTool, screenshotTool: !!screenshotTool })
              }
            }
          }

          // For browser_navigate, add a small delay after to ensure page loads
          if (selectedTool.name === 'browser_navigate') {
            // Invoke navigation
            const navResult = await invokeMCPTool({
              serverId: agent.id,
              tool: selectedTool.name,
              arguments: toolArguments,
              apiKey,
            })
            
            // Update message to show navigation completed
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === loadingMessage.id
                  ? {
                      ...msg,
                      content: `Navigated to ${toolArguments.url || 'the page'}. Page is loading...`,
                    }
                  : msg
              )
            )
            
            // Wait a moment for page to load before returning
            await new Promise(resolve => setTimeout(resolve, 2000))
            
            const responseText = navResult.content
              .map((c: any) => c.text || c.data || '')
              .join('\n\n')
            
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === loadingMessage.id
                  ? {
                      ...msg,
                      content: responseText || `Successfully navigated to ${toolArguments.url}`,
                    }
                  : msg
              )
            )
            setIsLoading(false)
            return
          }
          
          // Invoke the MCP tool via backend proxy
          const result = await invokeMCPTool({
            serverId: agent.id, // Use agent.id (which is serverId) instead of endpoint
            tool: selectedTool.name,
            arguments: toolArguments,
            apiKey,
          })

          // Extract text and images from result
          const textParts: string[] = []
          let imageAttachment: ChatMessage["contextAttachment"] | undefined = undefined
          
          for (const contentItem of result.content) {
            if (contentItem.type === 'image' && contentItem.data) {
              // Handle base64 image data
              const mimeType = contentItem.mimeType || 'image/png'
              const imageDataUrl = `data:${mimeType};base64,${contentItem.data}`
              
              imageAttachment = {
                type: 'image',
                url: imageDataUrl,
                name: selectedTool.name === 'browser_take_screenshot' ? 'Screenshot' : 'Image',
              }
            } else if (contentItem.type === 'text' && contentItem.text) {
              textParts.push(contentItem.text)
            } else if (contentItem.data && !contentItem.type) {
              // Fallback: treat as text
              textParts.push(contentItem.data)
            }
          }

          const responseText = textParts.join('\n\n') || "Request completed successfully."

          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === loadingMessage.id
                ? {
                    ...msg,
                    content: responseText,
                    ...(imageAttachment && { contextAttachment: imageAttachment }),
                  }
                : msg
            )
          )
          setIsLoading(false)
        } catch (error) {
          console.error('Agent invocation error:', error)
          const errorMessage: ChatMessage = {
            id: `error-${Date.now()}`,
            role: "assistant",
            content: `Sorry, I encountered an error calling ${selectedAgent.name}: ${error instanceof Error ? error.message : 'Unknown error'}`,
            timestamp: new Date(),
            agentName: selectedAgent.name,
          }
          setMessages((prev) => [...prev, errorMessage])
          setIsLoading(false)
          toast({
            title: "Agent invocation failed",
            description: error instanceof Error ? error.message : "Unknown error",
            variant: "destructive",
          })
        }
      } else if (attachment && (attachment.type === "image" || attachment.type === "glazyr")) {
        // Handle image/glazyr attachments - analyze with vision API
        try {
          // If attachment has a URL (data URL), convert to File for analysis
          if (attachment.url) {
            const loadingMessage: ChatMessage = {
              id: `loading-${Date.now()}`,
              role: "assistant",
              content: `Analyzing ${attachment.name || 'image'}...`,
              timestamp: new Date(),
              agentName: "Vision Agent",
            }
            setMessages((prev) => [...prev, loadingMessage])

            // Convert data URL to File if needed
            let file: File
            if (attachment.url.startsWith('data:')) {
              const response = await fetch(attachment.url)
              const blob = await response.blob()
              file = new File([blob], attachment.name || 'image.png', { type: blob.type })
            } else {
              // If it's already a URL, fetch it
              const response = await fetch(attachment.url)
              const blob = await response.blob()
              file = new File([blob], attachment.name || 'image.png', { type: blob.type })
            }

            const result = await analyzeDocument({
              file,
              query: content || "What do you see in this image? Provide a detailed analysis.",
            })

            const analysisText = result.analysis.summary || result.analysis.text || 'Analysis completed.'
            const insights = result.analysis.insights 
              ? `\n\nKey Insights:\n${result.analysis.insights.map((i, idx) => `${idx + 1}. ${i}`).join('\n')}`
              : ''

            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === loadingMessage.id
                  ? {
                      ...msg,
                      content: analysisText + insights,
                    }
                  : msg
              )
            )
            setIsLoading(false)
          } else {
            // Fallback if no URL
            throw new Error('No image data available for analysis')
          }
        } catch (error) {
          console.error('Image analysis error:', error)
          const errorMessage: ChatMessage = {
            id: `error-${Date.now()}`,
            role: "assistant",
            content: `Sorry, I encountered an error analyzing the image: ${error instanceof Error ? error.message : 'Unknown error'}`,
            timestamp: new Date(),
            agentName: "Vision Agent",
          }
          setMessages((prev) => [...prev, errorMessage])
          setIsLoading(false)
          toast({
            title: "Analysis failed",
            description: error instanceof Error ? error.message : "Unknown error",
            variant: "destructive",
          })
        }
      } else if (isRouter) {
        // Intelligent routing: analyze message and select best agent
        try {
          const routingDecision = routeToAgent(
            content,
            agents,
            attachment,
            routingHistoryRef.current
          )

          console.log('🤖 Routing decision:', {
            message: content,
            selectedAgent: routingDecision.agentName,
            confidence: routingDecision.confidence,
            reason: routingDecision.reason,
          })

          if (!routingDecision.agent) {
            // No suitable agent found
            const errorMessage: ChatMessage = {
              id: `error-${Date.now()}`,
              role: "assistant",
              content: `I couldn't find a suitable agent to handle your request: "${content}". Available agents: ${agents.map(a => a.name).join(', ')}`,
              timestamp: new Date(),
              agentName: "Router",
            }
            setMessages((prev) => [...prev, errorMessage])
            setIsLoading(false)
            return
          }

          // Use the selected agent to handle the request
          const selectedAgent = agentOptions.find((a) => a.id === routingDecision.agent.id)
          if (!selectedAgent) {
            throw new Error(`Selected agent ${routingDecision.agent.id} not found in agent options`)
          }

          // Temporarily set selected agent to the routed agent
          const originalSelectedAgentId = selectedAgentId
          setSelectedAgentId(routingDecision.agent.id)

          // Add routing message
          const routingMessage: ChatMessage = {
            id: `routing-${Date.now()}`,
            role: "assistant",
            content: `• Routed to ${routingDecision.agentName}`,
            timestamp: new Date(),
            agentName: "Router",
          }
          setMessages((prev) => [...prev, routingMessage])

          // Invoke the selected agent directly (bypassing router to avoid recursion)
          const routedAgent = agents.find((a) => a.id === routingDecision.agent.id)
          if (!routedAgent) {
            throw new Error(`Routed agent ${routingDecision.agent.id} not found`)
          }

          // Check if this is a STDIO-based server
          const isStdioServer = routedAgent.endpoint && routedAgent.endpoint.startsWith('stdio://')
          
          // Only HTTP-based servers need endpoint URLs
          if (!isStdioServer && (!routedAgent.endpoint || routedAgent.endpoint.trim() === '' || routedAgent.endpoint === routedAgent.id)) {
            throw new Error(`Agent "${routingDecision.agentName}" does not have a valid endpoint configured.`)
          }

          // Add loading message
          const loadingMessage: ChatMessage = {
            id: `loading-${Date.now()}`,
            role: "assistant",
            content: `Processing your request with ${routingDecision.agentName}...`,
            timestamp: new Date(),
            agentName: routingDecision.agentName,
          }
          setMessages((prev) => [...prev, loadingMessage])

          // Parse agent manifest to find available tools
          let manifestData: any = {}
          try {
            manifestData = routedAgent.manifest ? JSON.parse(routedAgent.manifest) : {}
          } catch (e) {
            console.error('Failed to parse agent manifest:', e)
          }

          // Get available tools from manifest
          const tools = manifestData.tools || []
          
          if (tools.length === 0) {
            throw new Error(`No tools available for agent ${routingDecision.agentName}`)
          }

          // Extract API key if needed
          const apiKey = manifestData.metadata?.apiKey

          // For Playwright and other MCP servers, intelligently select and parse tools
          let selectedTool = tools.find((t: any) => t.name === "agent_executor") || tools[0]
          
          // Build tool arguments based on the tool's input schema
          let toolArguments: Record<string, any> = {}
          
          // Check the tool's input schema to determine the correct parameter name
          if (selectedTool.inputSchema && selectedTool.inputSchema.properties) {
            const properties = selectedTool.inputSchema.properties as Record<string, any>
            const required = selectedTool.inputSchema.required || []
            
            // Find the first string property that seems to be the main input
            const inputParamNames = ['input', 'query', 'prompt', 'text', 'message']
            let foundParam: string | null = null
            
            for (const paramName of inputParamNames) {
              if (properties[paramName] && properties[paramName].type === 'string') {
                foundParam = paramName
                break
              }
            }
            
            if (!foundParam && required.length > 0) {
              const firstRequired = required[0]
              if (properties[firstRequired] && properties[firstRequired].type === 'string') {
                foundParam = firstRequired
              }
            }
            
            if (!foundParam) {
              foundParam = selectedTool.name === "agent_executor" ? "input" : "query"
            }
            
            toolArguments[foundParam] = content
          } else {
            toolArguments[selectedTool.name === "agent_executor" ? "input" : "query"] = content
          }
          
          // Add attachment if present
          if (attachment) {
            toolArguments.attachment = attachment
          }

          // Handle browser tools (Playwright) - same logic as before
          const hasBrowserTools = tools.some((t: any) => t.name?.startsWith('browser_'))
          if (hasBrowserTools) {
            const toolName = selectTool(content, tools.map((t: any) => ({
              name: t.name,
              description: t.description || '',
            })))
            
            if (toolName) {
              selectedTool = tools.find((t: any) => t.name === toolName) || selectedTool
              
              if (selectedTool.inputSchema) {
                const parsedParams = parseToolParameters(
                  content,
                  selectedTool.name,
                  selectedTool.inputSchema
                )
                
                toolArguments = {
                  ...parsedParams,
                  ...(Object.keys(parsedParams).length === 0 && { query: content }),
                }
              }
            
              // Handle navigate + screenshot workflow
              const lowerContent = content.toLowerCase()
              const wantsScreenshot = lowerContent.includes('screenshot') || 
                                      lowerContent.includes('capture') ||
                                      lowerContent.includes('picture') ||
                                      lowerContent.includes('snap')
              const wantsNavigate = lowerContent.includes('navigate') ||
                                   lowerContent.includes('avigate') ||
                                   lowerContent.includes('go to') ||
                                   lowerContent.includes('goto') ||
                                   lowerContent.includes('visit') ||
                                   lowerContent.includes('open') ||
                                   /https?:\/\/[^\s]+/i.test(content)
              
              let urlMatch = content.match(/https?:\/\/[^\s]+/i)
              if (!urlMatch) {
                urlMatch = content.match(/(?:go to|navigate to|visit|open|avigate to)\s+([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i)
              }
              if (!urlMatch) {
                urlMatch = content.match(/(?:screenshot|capture|picture)\s+(?:of|from)\s+([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i)
              }
              if (!urlMatch) {
                urlMatch = content.match(/\b([a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}\b/i)
              }
              const hasUrl = !!urlMatch
              
              if (wantsScreenshot && (wantsNavigate || hasUrl)) {
                const navigateTool = tools.find((t: any) => t.name === 'browser_navigate')
                const screenshotTool = tools.find((t: any) => t.name === 'browser_take_screenshot')
                
                if (navigateTool && screenshotTool) {
                  let url = null
                  if (urlMatch) {
                    const matchedText = urlMatch[0]
                    if (matchedText.startsWith('http')) {
                      url = matchedText
                    } else {
                      const domain = urlMatch[1] || urlMatch[0]
                      const cleanDomain = domain.replace(/[.,;!?]+$/, '').trim()
                      url = cleanDomain.startsWith('http') ? cleanDomain : `https://${cleanDomain}`
                    }
                  }
                  
                  if (url) {
                    try {
                      await invokeMCPTool({
                        serverId: routedAgent.id,
                        tool: 'browser_navigate',
                        arguments: { url },
                        apiKey,
                      })
                      
                      setMessages((prev) =>
                        prev.map((msg) =>
                          msg.id === loadingMessage.id
                            ? {
                                ...msg,
                                content: `Navigated to ${url}. Waiting for page to load...`,
                              }
                            : msg
                        )
                      )
                      
                      await new Promise(resolve => setTimeout(resolve, 3000))
                      
                      const screenshotResult = await invokeMCPTool({
                        serverId: routedAgent.id,
                        tool: 'browser_take_screenshot',
                        arguments: { type: 'png', fullPage: false },
                        apiKey,
                      })
                      
                      const textParts: string[] = []
                      let imageAttachment: ChatMessage["contextAttachment"] | undefined = undefined
                      
                      for (const contentItem of screenshotResult.content || []) {
                        if (contentItem.type === 'image' && contentItem.data) {
                          const mimeType = contentItem.mimeType || 'image/png'
                          const imageDataUrl = `data:${mimeType};base64,${contentItem.data}`
                          imageAttachment = {
                            type: 'image',
                            url: imageDataUrl,
                            name: 'Screenshot',
                          }
                        } else if (contentItem.type === 'text' && contentItem.text) {
                          textParts.push(contentItem.text)
                        }
                      }
                      
                      const responseText = textParts.join('\n\n') || 'Screenshot captured successfully!'
                      
                      setMessages((prev) =>
                        prev.map((msg) =>
                          msg.id === loadingMessage.id
                            ? {
                                ...msg,
                                content: `Navigated to ${url} and captured screenshot.\n\n${responseText}`,
                                ...(imageAttachment && { contextAttachment: imageAttachment }),
                              }
                            : msg
                        )
                      )
                      setIsLoading(false)
                      
                      // Track successful routing
                      routingHistoryRef.current.set(content.toLowerCase(), {
                        success: true,
                        agentId: routingDecision.agent.id,
                      })
                      return
                    } catch (error) {
                      console.error('Multi-step operation error:', error)
                    }
                  }
                }
              }
            }
          }

          // Invoke the MCP tool via backend proxy
          try {
            const result = await invokeMCPTool({
              serverId: routedAgent.id,
              tool: selectedTool.name,
              arguments: toolArguments,
              apiKey,
            })

            // Extract text and images from result
            const textParts: string[] = []
            let imageAttachment: ChatMessage["contextAttachment"] | undefined = undefined
            
            for (const contentItem of result.content) {
              if (contentItem.type === 'image' && contentItem.data) {
                const mimeType = contentItem.mimeType || 'image/png'
                const imageDataUrl = `data:${mimeType};base64,${contentItem.data}`
                
                imageAttachment = {
                  type: 'image',
                  url: imageDataUrl,
                  name: selectedTool.name === 'browser_take_screenshot' ? 'Screenshot' : 'Image',
                }
              } else if (contentItem.type === 'text' && contentItem.text) {
                textParts.push(contentItem.text)
              } else if (contentItem.data && !contentItem.type) {
                textParts.push(contentItem.data)
              }
            }

            const responseText = textParts.join('\n\n') || "Request completed successfully."

            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === loadingMessage.id
                  ? {
                      ...msg,
                      content: responseText,
                      ...(imageAttachment && { contextAttachment: imageAttachment }),
                    }
                  : msg
              )
            )
            setIsLoading(false)
            
            // Track successful routing
            routingHistoryRef.current.set(content.toLowerCase(), {
              success: true,
              agentId: routingDecision.agent.id,
            })
          } catch (agentError) {
            // Track failed routing
            routingHistoryRef.current.set(content.toLowerCase(), {
              success: false,
              agentId: routingDecision.agent.id,
            })
            
            // If routing failed and confidence was low, try fallback
            if (routingDecision.confidence < 0.7 && agents.length > 1) {
              console.log('⚠️ Low confidence routing failed, trying fallback...')
              const fallbackAgents = agents.filter(a => 
                a.id !== routingDecision.agent.id && 
                a.status === 'online' &&
                a.endpoint && 
                (a.endpoint.startsWith('stdio://') || (a.endpoint !== a.id && a.endpoint.trim() !== ''))
              )
              
              if (fallbackAgents.length > 0) {
                const fallbackDecision = routeToAgent(content, fallbackAgents, attachment, routingHistoryRef.current)
                if (fallbackDecision.agent) {
                  console.log(`🔄 Trying fallback agent: ${fallbackDecision.agentName}`)
                  // Recursively try with fallback (but only once)
                  setMessages((prev) =>
                    prev.map((msg) =>
                      msg.id === loadingMessage.id
                        ? {
                            ...msg,
                            content: `Previous agent failed. Trying ${fallbackDecision.agentName}...`,
                          }
                        : msg
                    )
                  )
                  
                  // Update routing message
                  setMessages((prev) =>
                    prev.map((msg) =>
                      msg.id === routingMessage.id
                        ? {
                            ...msg,
                            content: `• Routed to ${fallbackDecision.agentName} (fallback)`,
                          }
                        : msg
                    )
                  )
                  
                  // Retry with fallback - but we need to avoid infinite recursion
                  // For now, just show error
                  throw new Error(`Original agent failed. Fallback agent available: ${fallbackDecision.agentName}`)
                }
              }
            }
            
            throw agentError
          }
        } catch (error) {
          console.error('Router error:', error)
          const errorMessage: ChatMessage = {
            id: `error-${Date.now()}`,
            role: "assistant",
            content: `Sorry, I encountered an error routing your request: ${error instanceof Error ? error.message : 'Unknown error'}`,
            timestamp: new Date(),
            agentName: "Router",
          }
          setMessages((prev) => [...prev, errorMessage])
          setIsLoading(false)
          toast({
            title: "Routing failed",
            description: error instanceof Error ? error.message : "Unknown error",
            variant: "destructive",
          })
        }
      } else {
        // Handle other requests (fallback to generic response)
        await new Promise((resolve) => setTimeout(resolve, 1000))

        const assistantMessage: ChatMessage = {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: `I understand you asked: "${content}". Let me help you with that. Based on my analysis, here are the key points you should consider...`,
          timestamp: new Date(),
          agentName: selectedAgent?.name,
        }

        setMessages((prev) => [...prev, assistantMessage])
        setIsLoading(false)
      }
    } catch (error) {
      console.error('Error handling message:', error)
      setIsLoading(false)
      toast({
        title: "Error",
        description: "Failed to process your message",
        variant: "destructive",
      })
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

  const handleFileSelected = async (file: File, preview?: string) => {
    const attachment: ChatMessage["contextAttachment"] = {
      type: file.type.startsWith("image/") ? "image" : "document",
      name: file.name,
      preview,
      url: preview, // Use preview URL for images
    }

    // Add user message with attachment
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: `Can you analyze this ${attachment.type}?`,
      timestamp: new Date(),
      contextAttachment: attachment,
    }
    setMessages((prev) => [...prev, userMessage])
    setIsLoading(true)

    try {
      // Add loading message
      const loadingMessage: ChatMessage = {
        id: `loading-${Date.now()}`,
        role: "assistant",
        content: `Analyzing ${file.name}...`,
        timestamp: new Date(),
        agentName: attachment.type === "image" || attachment.type === "glazyr" ? "Vision Agent" : "Document Processing",
      }
      setMessages((prev) => [...prev, loadingMessage])

      // Analyze the document using backend
      const result = await analyzeDocument({
        file,
        query: `Can you analyze this ${attachment.type} and provide key insights?`,
      })

      // Update loading message with analysis results
      const analysisText = result.analysis.summary || result.analysis.text || 'Analysis completed.'
      const insights = result.analysis.insights 
        ? `\n\nKey Insights:\n${result.analysis.insights.map((i, idx) => `${idx + 1}. ${i}`).join('\n')}`
        : ''

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === loadingMessage.id
            ? {
                ...msg,
                content: analysisText + insights,
              }
            : msg
        )
      )
      setIsLoading(false)
    } catch (error) {
      console.error('Document analysis error:', error)
      const errorMessage: ChatMessage = {
        id: `error-${Date.now()}`,
        role: "assistant",
        content: `Sorry, I encountered an error analyzing the document: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date(),
        agentName: "Document Processing",
      }
      setMessages((prev) => [...prev, errorMessage])
      setIsLoading(false)
      toast({
        title: "Analysis failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      })
    }
  }

  const handleGlazyrCapture = () => {
    setGlazyrDialogOpen(true)
  }

  const handleGlazyrCaptured = (imageDataUrl: string) => {
    const attachment: ChatMessage["contextAttachment"] = {
      type: "glazyr",
      name: "Screen capture",
      url: imageDataUrl, // Base64 data URL
      preview: imageDataUrl, // Use same for preview
    }

    handleSendMessage("What do you see in this screenshot?", attachment)
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] relative overflow-hidden">
      <AgentSelector agents={agentOptions} selectedAgentId={selectedAgentId} onAgentChange={setSelectedAgentId} />

      <ScrollArea className="flex-1 px-6 overflow-y-auto" ref={scrollAreaRef}>
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
