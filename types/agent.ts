export interface MCPAgent {
  id: string
  name: string
  endpoint: string
  status: "online" | "offline" | "warning"
  lastActive: Date
  capabilities: string[]
  manifest: string
  httpHeaders?: string
  metadata?: Record<string, unknown>
  metrics?: {
    avgLatency: number
    p95Latency: number
    uptime: number
  }
  activityLog?: ActivityLog[]
}

export interface ActivityLog {
  id: string
  timestamp: Date
  level: "info" | "warning" | "error"
  message: string
}
