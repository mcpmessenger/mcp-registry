export interface ChatMessage {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: Date
  agentName?: string
  contextAttachment?: {
    type: "image" | "document" | "glazyr"
    url?: string
    name?: string
    preview?: string
  }
  audioUrl?: string
}

export interface AgentOption {
  id: string
  name: string
  type: "agent" | "router"
}
