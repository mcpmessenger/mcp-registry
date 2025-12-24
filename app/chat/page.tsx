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
import { mockAgents } from "@/lib/mock-data"

const agentOptions: AgentOption[] = [
  { id: "router", name: "Auto-Route (Recommended)", type: "router" },
  ...mockAgents
    .filter((a) => a.status === "online")
    .map((a) => ({
      id: a.id,
      name: a.name,
      type: "agent" as const,
    })),
]

const initialMessages: ChatMessage[] = [
  {
    id: "1",
    role: "assistant",
    content:
      "Hello! I'm your MCP assistant. I can help you with vision analysis, data processing, document analysis, and more. How can I assist you today?",
    timestamp: new Date(Date.now() - 1000 * 60 * 5),
    audioUrl: "https://example.com/tts/1.mp3",
  },
]

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages)
  const [selectedAgentId, setSelectedAgentId] = useState("router")
  const [isLoading, setIsLoading] = useState(false)
  const [voiceDialogOpen, setVoiceDialogOpen] = useState(false)
  const [fileDialogOpen, setFileDialogOpen] = useState(false)
  const [glazyrDialogOpen, setGlazyrDialogOpen] = useState(false)
  const scrollAreaRef = useRef<HTMLDivElement>(null)

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

    // Simulate routing and response
    await new Promise((resolve) => setTimeout(resolve, 1500))

    const selectedAgent = agentOptions.find((a) => a.id === selectedAgentId)
    const isRouter = selectedAgentId === "router"
    const agentName = isRouter
      ? attachment?.type === "image" || attachment?.type === "glazyr"
        ? "Vision Agent"
        : attachment?.type === "document"
          ? "Document Processing"
          : "Data Analysis Agent"
      : selectedAgent?.name

    const assistantMessage: ChatMessage = {
      id: `assistant-${Date.now()}`,
      role: "assistant",
      content: attachment
        ? `I've analyzed the ${attachment.type} you provided. Here are my findings: The content shows comprehensive data patterns with key insights about performance metrics and trends. Would you like me to elaborate on any specific aspect?`
        : `I understand you asked: "${content}". Let me help you with that. Based on my analysis, here are the key points you should consider...`,
      timestamp: new Date(),
      agentName: isRouter ? agentName : undefined,
      audioUrl: "https://example.com/tts/response.mp3",
    }

    setMessages((prev) => [...prev, assistantMessage])
    setIsLoading(false)
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
