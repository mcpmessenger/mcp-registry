export interface ChatMessage {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: Date
  agentName?: string
  imageUrl?: string
  imageData?: string // Base64 encoded image data
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
