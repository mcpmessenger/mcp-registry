"use client"

import type { MCPAgent } from "@/types/agent"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { StatusBadge } from "@/components/status-badge"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Activity, Code, TrendingUp, ExternalLink, Globe } from "lucide-react"

interface AgentDetailsDialogProps {
  agent: MCPAgent | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AgentDetailsDialog({ agent, open, onOpenChange }: AgentDetailsDialogProps) {
  if (!agent) return null

  const formatTimestamp = (date: Date) => {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date)
  }

  // Extract documentation and server URLs from metadata
  const metadata = agent.metadata && typeof agent.metadata === 'object' 
    ? agent.metadata as Record<string, unknown>
    : null
  
  const docsUrl = metadata?.documentation as string | undefined
  const serverUrl = metadata?.endpoint as string | undefined
  const npmPackage = metadata?.npmPackage as string | undefined
  const npmUrl = npmPackage ? `https://www.npmjs.com/package/${npmPackage}` : undefined

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh]">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-2xl">{agent.name}</DialogTitle>
            <StatusBadge status={agent.status} />
          </div>
          <DialogDescription className="font-mono text-xs pt-1">{agent.endpoint}</DialogDescription>
          {(docsUrl || serverUrl || npmUrl) && (
            <div className="flex flex-wrap gap-3 pt-2">
              {docsUrl && (
                <a
                  href={docsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline flex items-center gap-1.5"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Documentation
                </a>
              )}
              {serverUrl && !agent.endpoint.startsWith('stdio://') && (
                <a
                  href={serverUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline flex items-center gap-1.5"
                >
                  <Globe className="h-3.5 w-3.5" />
                  Server URL
                </a>
              )}
              {npmUrl && (
                <a
                  href={npmUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline flex items-center gap-1.5"
                >
                  <Code className="h-3.5 w-3.5" />
                  npm Package
                </a>
              )}
            </div>
          )}
        </DialogHeader>

        <ScrollArea className="max-h-[calc(85vh-120px)]">
          <div className="space-y-6 pr-4">
            {/* Capabilities */}
            <div>
              <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                <Badge variant="outline" className="h-5 w-5 p-0 justify-center">
                  <TrendingUp className="h-3 w-3" />
                </Badge>
                Capabilities
              </h3>
              <div className="flex flex-wrap gap-2">
                {agent.capabilities.map((capability) => (
                  <Badge key={capability} variant="secondary">
                    {capability}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Metrics */}
            {agent.metrics && (
              <div>
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <Badge variant="outline" className="h-5 w-5 p-0 justify-center">
                    <Activity className="h-3 w-3" />
                  </Badge>
                  Performance Metrics (24h)
                </h3>
                <div className="grid grid-cols-3 gap-4">
                  <div className="rounded-lg border border-border bg-muted/30 p-4">
                    <p className="text-xs text-muted-foreground mb-1">Avg Latency</p>
                    <p className="text-2xl font-bold">{agent.metrics.avgLatency}ms</p>
                  </div>
                  <div className="rounded-lg border border-border bg-muted/30 p-4">
                    <p className="text-xs text-muted-foreground mb-1">P95 Latency</p>
                    <p className="text-2xl font-bold">{agent.metrics.p95Latency}ms</p>
                  </div>
                  <div className="rounded-lg border border-border bg-muted/30 p-4">
                    <p className="text-xs text-muted-foreground mb-1">Uptime</p>
                    <p className="text-2xl font-bold">{agent.metrics.uptime}%</p>
                  </div>
                </div>
              </div>
            )}

            {/* Manifest */}
            <div>
              <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                <Badge variant="outline" className="h-5 w-5 p-0 justify-center">
                  <Code className="h-3 w-3" />
                </Badge>
                MCP Manifest
              </h3>
              <pre className="rounded-lg border border-border bg-muted p-4 text-xs font-mono overflow-x-auto">
                {agent.manifest}
              </pre>
            </div>

            {/* Activity Log */}
            {agent.activityLog && agent.activityLog.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <Badge variant="outline" className="h-5 w-5 p-0 justify-center">
                    <Activity className="h-3 w-3" />
                  </Badge>
                  Recent Activity
                </h3>
                <div className="space-y-2">
                  {agent.activityLog.map((log) => (
                    <div key={log.id} className="flex items-start gap-3 rounded-lg border border-border p-3 text-sm">
                      <div
                        className={`mt-0.5 h-2 w-2 rounded-full ${
                          log.level === "error"
                            ? "bg-destructive"
                            : log.level === "warning"
                              ? "bg-warning"
                              : "bg-success"
                        }`}
                      />
                      <div className="flex-1 space-y-1">
                        <p className="text-foreground">{log.message}</p>
                        <p className="text-xs text-muted-foreground">{formatTimestamp(log.timestamp)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
