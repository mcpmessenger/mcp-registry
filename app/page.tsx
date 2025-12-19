"use client"

import { useState } from "react"
import { mockAgents } from "@/lib/mock-data"
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
  const [agents, setAgents] = useState<MCPAgent[]>(mockAgents)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [selectedAgent, setSelectedAgent] = useState<MCPAgent | null>(null)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [editingAgent, setEditingAgent] = useState<MCPAgent | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deletingAgent, setDeletingAgent] = useState<MCPAgent | null>(null)
  const { toast } = useToast()

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
