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
import { getLogoUrl } from "@/lib/logo-mapping"
import Image from "next/image"

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

  // Get backglow color based on status
  const getBackglowColor = () => {
    switch (agent.status) {
      case 'active':
        return 'from-green-500/20 via-emerald-500/15 to-green-400/10'
      case 'pre-integration':
        return 'from-yellow-500/20 via-amber-500/15 to-yellow-400/10'
      case 'offline':
        return 'from-red-500/20 via-rose-500/15 to-red-400/10'
      default:
        return 'from-blue-500/20 via-purple-500/15 to-blue-400/10'
    }
  }

  return (
    <div className={`
      relative rounded-xl border border-white/20 p-0
      backdrop-blur-md bg-gradient-to-br from-white/10 to-white/5
      transition-all duration-300 cursor-pointer
      hover:scale-[1.02] hover:border-white/30
      active:scale-[0.98] sm:hover:scale-[1.02]
      shadow-lg hover:shadow-xl
      overflow-hidden group
      touch-manipulation
    `}>
      {/* Backglow effect - status-based */}
      <div className={`
        absolute -inset-0.5 sm:-inset-1 bg-gradient-to-br ${getBackglowColor()}
        opacity-0 group-hover:opacity-100
        transition-opacity duration-500 blur-xl sm:blur-2xl
      `} />
      
      <div className="relative z-10">
        <Card className="border-0 bg-transparent shadow-none p-0">
      <CardHeader className="pb-3 px-5 pt-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            {/* Logo */}
            {(() => {
              const logoUrl = agent.logoUrl || getLogoUrl(agent.id, agent.name, agent.metadata)
              if (logoUrl) {
                return (
                  <div className="relative w-12 h-12 sm:w-14 sm:h-14 flex-shrink-0 rounded-lg overflow-hidden border border-white/10 bg-white/5 backdrop-blur-sm">
                    <Image
                      src={logoUrl}
                      alt={agent.name}
                      fill
                      className="object-contain p-1.5"
                      sizes="(max-width: 640px) 48px, 56px"
                    />
                  </div>
                )
              }
              return (
                <div className="w-12 h-12 sm:w-14 sm:h-14 flex-shrink-0 rounded-lg bg-gradient-to-br from-primary/20 to-secondary/20 border border-white/10 flex items-center justify-center">
                  <span className="text-lg sm:text-xl font-bold text-primary">
                    {agent.name.charAt(0).toUpperCase()}
                  </span>
                </div>
              )
            })()}
            <div className="space-y-1 flex-1 min-w-0">
              <CardTitle className="text-lg truncate">{agent.name}</CardTitle>
              <CardDescription className="text-xs font-mono truncate">{agent.endpoint}</CardDescription>
            </div>
          </div>
          <StatusBadge status={agent.status} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4 px-5 pb-5">
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
      </div>
    </div>
  )
}
