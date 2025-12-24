"use client"

import { useState, useEffect } from "react"
import { getServers, publishServer, updateServer, deleteServer } from "@/lib/api"
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

  // Fetch servers from backend API on mount
  useEffect(() => {
    let isMounted = true
    
    async function fetchServers() {
      try {
        setIsLoading(true)
        setError(null)
        console.log('Fetching servers from backend...')
        const servers = await getServers()
        console.log('Received servers:', servers)
        console.log('First server structure:', servers[0])
        console.log('Server count:', servers.length)
        
        if (isMounted) {
          // Filter out empty objects and validate
          const validServers = servers.filter(s => {
            const isValid = s && s.serverId && s.name
            if (!isValid) {
              console.warn('Invalid server filtered out:', s)
            }
            return isValid
          })
          console.log('Valid servers after filtering:', validServers.length)
          
          if (validServers.length === 0 && servers.length > 0) {
            console.error('All servers are invalid/empty:', servers)
            setError('Servers returned but data is invalid. Check console for details.')
            return
          }
          
          try {
            const transformedAgents = transformServersToAgents(validServers)
            console.log('Transformed agents:', transformedAgents)
            console.log('First transformed agent:', transformedAgents[0])
            setAgents(transformedAgents)
          } catch (transformError) {
            console.error('Error transforming servers:', transformError)
            setError(`Failed to transform servers: ${transformError instanceof Error ? transformError.message : 'Unknown error'}`)
          }
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

  const handleSaveAgent = async (data: Partial<MCPAgent> & { command?: string; args?: string; credentials?: string }) => {
    try {
      // Determine if this is HTTP or STDIO server
      const isStdioServer = ((data as any).command && (data as any).args) || (!data.endpoint || data.endpoint.trim() === '')
      
      // Validate based on server type
      if (!isStdioServer && (!data.endpoint || data.endpoint.trim() === '')) {
        toast({
          title: "Endpoint required",
          description: "Please provide an endpoint URL for HTTP-based MCP agents.",
          variant: "destructive",
        })
        return
      }
      
      if (isStdioServer && (!(data as any).command || !(data as any).args)) {
        toast({
          title: "Command and Args required",
          description: "Please provide command and arguments for STDIO-based MCP agents.",
          variant: "destructive",
        })
        return
      }

      // Parse manifest JSON
      let manifestData: any = {}
      try {
        manifestData = data.manifest ? JSON.parse(data.manifest) : {}
      } catch (e) {
        toast({
          title: "Invalid manifest",
          description: "The manifest must be valid JSON.",
          variant: "destructive",
        })
        return
      }

      // Parse HTTP headers if provided (optional)
      let httpHeaders: Record<string, unknown> | undefined
      if (data.httpHeaders && data.httpHeaders.trim() !== "") {
        try {
          const parsed = JSON.parse(data.httpHeaders)
          if (parsed && typeof parsed === 'object') {
            httpHeaders = parsed
          } else {
            throw new Error('Headers must be a JSON object')
          }
        } catch (e) {
          toast({
            title: "Invalid HTTP headers",
            description: "HTTP headers must be valid JSON object.",
            variant: "destructive",
          })
          return
        }
      }

      // Generate serverId from name if not provided
      const name = data.name || editingAgent?.name || "New Agent"
      // Remove trailing dashes and ensure valid format
      const baseServerId = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, '').replace(/^-+/, '')
      const serverId = manifestData.serverId || editingAgent?.id || 
        `com.mcp-registry/${baseServerId}`

      // Parse credentials (can be simple API key or JSON object)
      let env: Record<string, string> | undefined = undefined
      const credentials = (data as any).credentials
      if (credentials && credentials.trim()) {
        try {
          // Try to parse as JSON first
          const parsed = JSON.parse(credentials)
          if (typeof parsed === 'object' && !Array.isArray(parsed)) {
            env = parsed
          } else {
            throw new Error('Credentials JSON must be an object')
          }
        } catch {
          // If not valid JSON, treat as simple API key
          env = { API_KEY: credentials }
          // Auto-map to common env var names based on agent name
          if (name.toLowerCase().includes('gemini') || name.toLowerCase().includes('banana')) {
            env.GEMINI_API_KEY = credentials
          }
        }
      }
      
      // Parse command args for STDIO servers
      let args: string[] | undefined = undefined
      if (isStdioServer && (data as any).args) {
        try {
          args = JSON.parse((data as any).args)
          if (!Array.isArray(args)) {
            throw new Error('Arguments must be a JSON array')
          }
        } catch (e) {
          toast({
            title: "Invalid arguments",
            description: "Arguments must be a valid JSON array (e.g., [\"nano-banana-mcp\"]).",
            variant: "destructive",
          })
          return
        }
      }
      
      // Transform form data to backend schema
      const publishData: any = {
        serverId,
        name,
        description: manifestData.description || (isStdioServer ? `${(data as any).command} ${(data as any).args}` : data.endpoint) || undefined,
        version: manifestData.version || "v0.1",
        command: isStdioServer ? (data as any).command : undefined,
        args: isStdioServer ? args : undefined,
        tools: manifestData.tools || [],
        capabilities: manifestData.capabilities || [],
        env: env,
        manifest: {
          ...manifestData,
          serverId: serverId,
          ...(isStdioServer ? {} : { endpoint: data.endpoint?.trim() }),
        },
        metadata: {
          ...(isStdioServer ? {} : { endpoint: data.endpoint?.trim() }),
          apiKey: credentials ? '***' : undefined,
          httpHeaders: httpHeaders,
        },
      }
      
      console.log('[Save Agent] Publishing data:', {
        serverId,
        name,
        hasCommand: !!publishData.command,
        hasArgs: !!publishData.args,
        hasEnv: !!publishData.env,
        toolsCount: publishData.tools?.length || 0,
      })

      if (editingAgent) {
        // Update existing server
        await updateServer(editingAgent.id, publishData)
        toast({
          title: "Agent updated",
          description: `${name} has been successfully updated.`,
        })
      } else {
        // Create new server
        await publishServer(publishData)
        toast({
          title: "Agent registered",
          description: `${name} has been successfully registered.`,
        })
      }

      // Refresh agents list from backend
      const servers = await getServers()
      const transformedAgents = transformServersToAgents(servers)
      setAgents(transformedAgents)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to save agent'
      console.error('Error saving agent:', error)
      toast({
        title: editingAgent ? "Update failed" : "Registration failed",
        description: errorMessage,
        variant: "destructive",
      })
    }
  }

  const handleConfirmDelete = async () => {
    if (!deletingAgent) return

    try {
      await deleteServer(deletingAgent.id)
      toast({
        title: "Agent deleted",
        description: `${deletingAgent.name} has been removed from the registry.`,
        variant: "destructive",
      })
      
      // Refresh agents list from backend
      const servers = await getServers()
      const transformedAgents = transformServersToAgents(servers)
      setAgents(transformedAgents)
      
      setDeleteOpen(false)
      setDeletingAgent(null)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete agent'
      console.error('Error deleting agent:', error)
      toast({
        title: "Delete failed",
        description: errorMessage,
        variant: "destructive",
      })
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
        </div>
      )}

      {error && (
        <div className="text-center py-12">
          <p className="text-destructive">Error: {error}</p>
          <p className="text-muted-foreground text-sm mt-2">Make sure the backend API is configured correctly</p>
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
