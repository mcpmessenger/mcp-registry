"use client"

import { useState, useEffect } from "react"
import { getServers } from "@/lib/api"
import { transformServersToAgents } from "@/lib/server-utils"
import type { MCPAgent } from "@/types/agent"
import { AgentCard } from "@/components/agent-card"
import { AgentDetailsDialog } from "@/components/agent-details-dialog"
import { AgentFormDialog } from "@/components/agent-form-dialog"
import { DeleteAgentDialog } from "@/components/delete-agent-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, Search } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

export default function RegistryPage() {
  const [agents, setAgents] = useState<MCPAgent[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [selectedAgent, setSelectedAgent] = useState<MCPAgent | null>(null)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [editingAgent, setEditingAgent] = useState<MCPAgent | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deletingAgent, setDeletingAgent] = useState<MCPAgent | null>(null)
  const { toast } = useToast()

  // Fetch servers from backend API
  useEffect(() => {
    let isMounted = true
    
    async function fetchServers() {
      try {
        setIsLoading(true)
        setError(null)
        console.log('Fetching servers from backend...')
        const servers = await getServers()
        console.log('Received servers:', servers)
        
        if (isMounted) {
          const transformedAgents = transformServersToAgents(servers)
          setAgents(transformedAgents)
          console.log('Transformed agents:', transformedAgents)
        }
      } catch (err) {
        if (isMounted) {
          const errorMessage = err instanceof Error ? err.message : 'Failed to fetch servers'
          console.error('Error fetching servers:', err)
          setError(errorMessage)
          toast({
            title: "Error loading servers",
            description: errorMessage,
            variant: "destructive",
          })
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    fetchServers()
    
    return () => {
      isMounted = false
    }
  }, [toast])

  const filteredAgents = agents.filter((agent) => {
    const matchesSearch =
      agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      agent.endpoint.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = statusFilter === "all" || agent.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const handleViewDetails = (agent: MCPAgent) => {
    setSelectedAgent(agent)
    setDetailsOpen(true)
  }

  const handleEdit = (agent: MCPAgent) => {
    setEditingAgent(agent)
    setFormOpen(true)
  }

  const handleDelete = (agent: MCPAgent) => {
    setDeletingAgent(agent)
    setDeleteOpen(true)
  }

  const handleAddNew = () => {
    setEditingAgent(null)
    setFormOpen(true)
  }

  const handleSaveAgent = (data: Partial<MCPAgent>) => {
    if (editingAgent) {
      setAgents((prev) =>
        prev.map((agent) =>
          agent.id === editingAgent.id
            ? {
                ...agent,
                ...data,
                capabilities: data.manifest
                  ? JSON.parse(data.manifest).capabilities || agent.capabilities
                  : agent.capabilities,
              }
            : agent,
        ),
      )
      toast({
        title: "Agent updated",
        description: `${data.name || editingAgent.name} has been successfully updated.`,
      })
    } else {
      const newAgent: MCPAgent = {
        id: (agents.length + 1).toString(),
        name: data.name || "New Agent",
        endpoint: data.endpoint || "",
        status: "online",
        lastActive: new Date(),
        capabilities: data.manifest ? JSON.parse(data.manifest).capabilities || [] : [],
        manifest: data.manifest || "{}",
        metrics: {
          avgLatency: 0,
          p95Latency: 0,
          uptime: 100,
        },
      }
      setAgents((prev) => [...prev, newAgent])
      toast({
        title: "Agent registered",
        description: `${newAgent.name} has been successfully registered.`,
      })
    }
  }

  const handleConfirmDelete = () => {
    if (deletingAgent) {
      setAgents((prev) => prev.filter((agent) => agent.id !== deletingAgent.id))
      toast({
        title: "Agent deleted",
        description: `${deletingAgent.name} has been removed from the registry.`,
        variant: "destructive",
      })
      setDeleteOpen(false)
      setDeletingAgent(null)
    }
  }

  const statusCounts = {
    all: agents.length,
    online: agents.filter((a) => a.status === "online").length,
    warning: agents.filter((a) => a.status === "warning").length,
    offline: agents.filter((a) => a.status === "offline").length,
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">MCP Agent Registry</h1>
          <p className="text-muted-foreground mt-1">Manage and monitor your Model Context Protocol agents</p>
        </div>
        <Button className="gap-2" onClick={handleAddNew}>
          <Plus className="h-4 w-4" />
          Add New Agent
        </Button>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">Total Agents</p>
          <p className="text-2xl font-bold mt-1">{statusCounts.all}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">Online</p>
          <p className="text-2xl font-bold mt-1 text-success">{statusCounts.online}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">Warning</p>
          <p className="text-2xl font-bold mt-1 text-warning">{statusCounts.warning}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">Offline</p>
          <p className="text-2xl font-bold mt-1 text-destructive">{statusCounts.offline}</p>
        </div>
      </div>

      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search agents by name or endpoint..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="online">Online</SelectItem>
            <SelectItem value="warning">Warning</SelectItem>
            <SelectItem value="offline">Offline</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading && (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4"></div>
          <p className="text-muted-foreground">Loading servers from backend...</p>
          <p className="text-muted-foreground text-sm mt-2">If this takes too long, check that the backend is running on http://localhost:3001</p>
        </div>
      )}

      {error && (
        <div className="text-center py-12">
          <p className="text-destructive">Error: {error}</p>
          <p className="text-muted-foreground text-sm mt-2">Make sure the backend server is running on http://localhost:3001</p>
        </div>
      )}

      {!isLoading && !error && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredAgents.map((agent) => (
              <AgentCard
                key={agent.id}
                agent={agent}
                onViewDetails={handleViewDetails}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            ))}
          </div>

          {filteredAgents.length === 0 && (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No agents found matching your filters.</p>
            </div>
          )}
        </>
      )}

      <AgentDetailsDialog agent={selectedAgent} open={detailsOpen} onOpenChange={setDetailsOpen} />
      <AgentFormDialog agent={editingAgent} open={formOpen} onOpenChange={setFormOpen} onSave={handleSaveAgent} />
      <DeleteAgentDialog
        agent={deletingAgent}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onConfirm={handleConfirmDelete}
      />
    </div>
  )
}
