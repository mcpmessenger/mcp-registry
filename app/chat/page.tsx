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
            .filter((a) => a.status === "online" && a.endpoint)
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
          if (!agent.endpoint || agent.endpoint.trim() === '' || agent.endpoint === agent.id) {
            // If endpoint is missing or equals serverId (fallback), provide helpful error
            const errorMsg = agent.endpoint === agent.id
              ? `Agent "${selectedAgent.name}" is missing an endpoint URL. Please edit the agent in the Registry page and add the endpoint (e.g., https://langchain-agent-mcp-server-554655392699.us-central1.run.app)`
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

          // Find the main tool (usually "agent_executor" for LangChain or first tool)
          const tools = manifestData.tools || []
          const mainTool = tools.find((t: any) => t.name === "agent_executor") || tools[0]

          if (!mainTool) {
            throw new Error(`No tools available for agent ${selectedAgent.name}`)
          }

          // Extract API key from agent metadata if available
          const apiKey = manifestData.metadata?.apiKey || agent.manifest ? 
            (() => {
              try {
                const m = JSON.parse(agent.manifest)
                return m.metadata?.apiKey
              } catch {
                return undefined
              }
            })() : undefined

          // Invoke the MCP tool via backend proxy
          const result = await invokeMCPTool({
            serverId: agent.id, // Use agent.id (which is serverId) instead of endpoint
            tool: mainTool.name,
            arguments: {
              query: content,
              ...(attachment && { attachment }),
            },
            apiKey,
          })

          // Update loading message with result
          const responseText = result.content
            .map((c) => c.text || c.data || '')
            .join('\n\n')

          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === loadingMessage.id
                ? {
                    ...msg,
                    content: responseText || "Request completed successfully.",
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
      } else {
        // Handle other requests (fallback to generic response)
        await new Promise((resolve) => setTimeout(resolve, 1000))

        const agentName = isRouter
          ? attachment?.type === "document"
            ? "Document Processing"
            : "Data Analysis Agent"
          : selectedAgent?.name

        const assistantMessage: ChatMessage = {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: `I understand you asked: "${content}". Let me help you with that. Based on my analysis, here are the key points you should consider...`,
          timestamp: new Date(),
          agentName: isRouter ? agentName : undefined,
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
