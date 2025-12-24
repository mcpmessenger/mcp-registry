"use client"

import type { MCPAgent } from "@/types/agent"
import { StatusBadge } from "@/components/status-badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Eye, Edit, Trash2, Activity } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { InstallButton } from "@/components/install-button"
import { transformAgentToServer } from "@/lib/server-utils"
import type { MCPServer } from "@/lib/api"

interface AgentCardProps {
  agent: MCPAgent
  onViewDetails: (agent: MCPAgent) => void
  onEdit: (agent: MCPAgent) => void
  onDelete: (agent: MCPAgent) => void
}

export function AgentCard({ agent, onViewDetails, onEdit, onDelete }: AgentCardProps) {
  const formatLastActive = (date: Date) => {
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / 1000 / 60)
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)

    if (days > 0) return `${days}d ago`
    if (hours > 0) return `${hours}h ago`
    return `${minutes}m ago`
  }

  return (
    <Card className="hover:border-primary/50 transition-colors">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg">{agent.name}</CardTitle>
            <CardDescription className="text-xs font-mono">{agent.endpoint}</CardDescription>
          </div>
          <StatusBadge status={agent.status} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Activity className="h-4 w-4" />
          <span>Last active: {formatLastActive(agent.lastActive)}</span>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {agent.capabilities.map((capability) => (
            <Badge key={capability} variant="secondary" className="text-xs">
              {capability}
            </Badge>
          ))}
        </div>

        {agent.metrics && (
          <div className="grid grid-cols-3 gap-3 pt-2 border-t border-border">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Avg Latency</p>
              <p className="text-sm font-semibold">{agent.metrics.avgLatency}ms</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">P95 Latency</p>
              <p className="text-sm font-semibold">{agent.metrics.p95Latency}ms</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Uptime</p>
              <p className="text-sm font-semibold">{agent.metrics.uptime}%</p>
            </div>
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <Button variant="outline" size="sm" className="flex-1 bg-transparent" onClick={() => onViewDetails(agent)}>
            <Eye className="h-3.5 w-3.5 mr-1.5" />
            Details
          </Button>
          <Button variant="outline" size="sm" className="flex-1 bg-transparent" onClick={() => onEdit(agent)}>
            <Edit className="h-3.5 w-3.5 mr-1.5" />
            Edit
          </Button>
          <Button variant="outline" size="sm" onClick={() => onDelete(agent)}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
        
        <div className="pt-2 border-t border-border">
          {(() => {
            try {
              const server = transformAgentToServer(agent)
              return <InstallButton server={server} />
            } catch (error) {
              console.error("Error transforming agent to server:", error)
              return null
            }
          })()}
        </div>
      </CardContent>
    </Card>
  )
}
