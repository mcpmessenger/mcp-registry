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
      // Priority: Check if endpoint exists in form data (HTTP) OR in existing server metadata
      const hasEndpointInForm = data.endpoint && data.endpoint.trim() !== '' && !data.endpoint.startsWith('stdio://')
      let hasEndpointInMetadata = false
      if (editingAgent && editingAgent.metadata && typeof editingAgent.metadata === 'object') {
        const metadata = editingAgent.metadata as Record<string, unknown>
        hasEndpointInMetadata = typeof metadata.endpoint === 'string' && metadata.endpoint.trim() !== ''
      }
      const hasEndpoint = hasEndpointInForm || hasEndpointInMetadata
      const hasCommandArgs = (data as any).command && (data as any).args
      
      // HTTP if endpoint exists, STDIO if command/args exist and no endpoint
      const isStdioServer = hasCommandArgs && !hasEndpoint
      
      console.log('[Save Agent] Server type detection:', {
        hasEndpointInForm,
        hasEndpointInMetadata,
        hasEndpoint,
        hasCommandArgs,
        isStdioServer: isStdioServer ? 'STDIO' : 'HTTP',
        editingAgentId: editingAgent?.id
      })
      
      // Validate based on server type
      if (!isStdioServer && (!data.endpoint || data.endpoint.trim() === '')) {
        toast({
          title: "Endpoint required",
          description: "Please provide an endpoint URL for HTTP-based MCP servers.",
          variant: "destructive",
        })
        return
      }
      
      if (isStdioServer && (!(data as any).command || !(data as any).args)) {
        toast({
          title: "Command and Args required",
          description: "Please provide command and arguments for STDIO-based MCP servers.",
          variant: "destructive",
        })
        return
      }

      // Parse manifest JSON (optional - will auto-discover if not provided)
      let manifestData: any = {}
      if (data.manifest && data.manifest.trim()) {
        try {
          manifestData = JSON.parse(data.manifest)
        } catch (e) {
          toast({
            title: "Invalid manifest",
            description: "The manifest must be valid JSON.",
            variant: "destructive",
          })
          return
        }
      }

      // Parse HTTP headers if provided (optional)
      let httpHeaders: Record<string, unknown> | undefined
      if (data.httpHeaders && data.httpHeaders.trim() !== "") {
        try {
          const headerValue = data.httpHeaders.trim()
          let parsed: Record<string, unknown>
          
          // Try parsing as JSON first
          try {
            parsed = JSON.parse(headerValue)
          } catch {
            // If not JSON, treat as plain API key and wrap it
            // Check if it looks like a Google Maps API key
            if (headerValue.startsWith('AIza')) {
              parsed = { "X-Goog-Api-Key": headerValue }
            } else {
              // Generic API key - user needs to specify header name
              throw new Error('Plain API key detected. Please use JSON format: {"X-Goog-Api-Key": "your-key"}')
            }
          }
          
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            httpHeaders = parsed
          } else {
            throw new Error('Headers must be a JSON object')
          }
        } catch (e) {
          toast({
            title: "Invalid HTTP headers",
            description: e instanceof Error ? e.message : "HTTP headers must be valid JSON object.",
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
        // For HTTP servers, explicitly set command/args to undefined (not null) to clear STDIO mode
        // Only include command/args if it's STDIO
        ...(isStdioServer ? {
          command: (data as any).command,
          args: args,
        } : {
          // HTTP servers: explicitly exclude command/args (undefined means clear/remove)
          command: undefined,
          args: undefined,
        }),
        tools: manifestData.tools || [],
        capabilities: manifestData.capabilities || [],
        env: env,
        manifest: {
          ...manifestData,
          serverId: serverId,
          ...(isStdioServer ? {} : { endpoint: data.endpoint?.trim() }),
        },
        metadata: (() => {
          // Start with existing metadata to preserve integration status and other fields
          let existingMetadata: Record<string, unknown> = {}
          if (editingAgent?.metadata && typeof editingAgent.metadata === 'object') {
            existingMetadata = editingAgent.metadata as Record<string, unknown>
          }
          
          // Build new metadata, preserving important fields
          return {
            ...existingMetadata, // Preserve all existing metadata first
            ...(isStdioServer ? {} : { endpoint: data.endpoint?.trim() }),
            apiKey: credentials ? '***' : undefined,
            httpHeaders: httpHeaders,
            // Include logoUrl from form data or existing metadata
            ...(data.metadata && typeof data.metadata === 'object' && (data.metadata as Record<string, unknown>).logoUrl
              ? { logoUrl: (data.metadata as Record<string, unknown>).logoUrl }
              : data.logoUrl
              ? { logoUrl: data.logoUrl }
              : existingMetadata.logoUrl
              ? { logoUrl: existingMetadata.logoUrl }
              : {}),
            // Preserve integration status - don't reset it when updating
            ...(existingMetadata.integrationStatus ? { integrationStatus: existingMetadata.integrationStatus } : {}),
            ...(existingMetadata.integrationReason ? { integrationReason: existingMetadata.integrationReason } : {}),
            ...(existingMetadata.integrationDetails ? { integrationDetails: existingMetadata.integrationDetails } : {}),
            ...(existingMetadata.integrationCheckedAt ? { integrationCheckedAt: existingMetadata.integrationCheckedAt } : {}),
          }
        })(),
      }
      
      console.log('[Save Agent] Server type:', isStdioServer ? 'STDIO' : 'HTTP')
      console.log('[Save Agent] Command:', publishData.command)
      console.log('[Save Agent] Args:', publishData.args)
      
      console.log('[Save Agent] Publishing data:', {
        serverId,
        name,
        hasCommand: !!publishData.command,
        hasArgs: !!publishData.args,
        hasEnv: !!publishData.env,
        hasHttpHeaders: !!httpHeaders,
        httpHeaders: httpHeaders,
        metadataKeys: publishData.metadata ? Object.keys(publishData.metadata) : [],
        toolsCount: publishData.tools?.length || 0,
      })

      if (editingAgent) {
        // Update existing server
        await updateServer(editingAgent.id, publishData)
        toast({
          title: "MCP server updated",
          description: `${name} has been successfully updated.`,
        })
      } else {
        // Create new server
        await publishServer(publishData)
        toast({
          title: "MCP server registered",
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
        title: "MCP server deleted",
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
    active: agents.filter((a) => a.status === "active").length,
    preIntegration: agents.filter((a) => a.status === "pre-integration").length,
    offline: agents.filter((a) => a.status === "offline").length,
  }

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">MCP Registry</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">Manage and monitor your Model Context Protocol servers on SlashMCP.com</p>
        </div>
        <Button className="gap-2 w-full sm:w-auto" onClick={handleAddNew}>
          <Plus className="h-4 w-4" />
          Add New MCP
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total MCP Servers */}
        <button
          onClick={() => setStatusFilter("all")}
          className={`
            relative rounded-xl border border-white/20 p-4 sm:p-5
            backdrop-blur-md bg-gradient-to-br from-white/10 to-white/5
            transition-all duration-300 cursor-pointer
            active:scale-[0.98] sm:hover:scale-[1.02] sm:hover:border-white/30
            touch-manipulation
            ${statusFilter === "all" 
              ? "ring-2 ring-primary/50 ring-offset-1 sm:ring-offset-2 ring-offset-background shadow-[0_0_20px_rgba(59,130,246,0.5)] sm:shadow-[0_0_30px_rgba(59,130,246,0.6)]" 
              : "shadow-lg sm:hover:shadow-xl"
            }
            overflow-hidden group w-full
          `}
        >
          {/* Backglow effect - ATM style */}
          <div className={`
            absolute -inset-0.5 sm:-inset-1 bg-gradient-to-br from-blue-500/40 via-purple-500/30 to-blue-400/20 
            ${statusFilter === "all" ? "opacity-100" : "opacity-0 sm:group-hover:opacity-60"} 
            transition-opacity duration-500 blur-xl sm:blur-2xl
          `} />
          
          <div className="relative z-10">
            <p className="text-xs sm:text-sm text-muted-foreground/80 font-medium">Total MCP Servers</p>
            <p className="text-2xl sm:text-3xl font-bold mt-1 sm:mt-2 bg-gradient-to-br from-foreground to-foreground/70 bg-clip-text text-transparent">
              {statusCounts.all}
            </p>
          </div>
        </button>

        {/* Active */}
        <button
          onClick={() => setStatusFilter("active")}
          className={`
            relative rounded-xl border border-white/20 p-4 sm:p-5
            backdrop-blur-md bg-gradient-to-br from-green-500/10 to-emerald-500/5
            transition-all duration-300 cursor-pointer
            active:scale-[0.98] sm:hover:scale-[1.02] sm:hover:border-green-400/40
            touch-manipulation
            ${statusFilter === "active" 
              ? "ring-2 ring-green-500/50 ring-offset-1 sm:ring-offset-2 ring-offset-background shadow-[0_0_20px_rgba(34,197,94,0.5)] sm:shadow-[0_0_30px_rgba(34,197,94,0.6)]" 
              : "shadow-lg sm:hover:shadow-xl"
            }
            overflow-hidden group w-full
          `}
        >
          {/* Backglow effect - green ATM style */}
          <div className={`
            absolute -inset-0.5 sm:-inset-1 bg-gradient-to-br from-green-500/50 via-emerald-500/40 to-green-400/30 
            ${statusFilter === "active" ? "opacity-100" : "opacity-0 sm:group-hover:opacity-60"} 
            transition-opacity duration-500 blur-xl sm:blur-2xl
          `} />
          
          <div className="relative z-10">
            <p className="text-xs sm:text-sm text-muted-foreground/80 font-medium">Active</p>
            <p className="text-2xl sm:text-3xl font-bold mt-1 sm:mt-2 text-success drop-shadow-[0_0_8px_rgba(34,197,94,0.3)] sm:drop-shadow-[0_0_12px_rgba(34,197,94,0.4)]">
              {statusCounts.active}
            </p>
          </div>
        </button>

        {/* Pre-Integration */}
        <button
          onClick={() => setStatusFilter("pre-integration")}
          className={`
            relative rounded-xl border border-white/20 p-4 sm:p-5
            backdrop-blur-md bg-gradient-to-br from-yellow-500/10 to-amber-500/5
            transition-all duration-300 cursor-pointer
            active:scale-[0.98] sm:hover:scale-[1.02] sm:hover:border-yellow-400/40
            touch-manipulation
            ${statusFilter === "pre-integration" 
              ? "ring-2 ring-yellow-500/50 ring-offset-1 sm:ring-offset-2 ring-offset-background shadow-[0_0_20px_rgba(234,179,8,0.5)] sm:shadow-[0_0_30px_rgba(234,179,8,0.6)]" 
              : "shadow-lg sm:hover:shadow-xl"
            }
            overflow-hidden group w-full
          `}
        >
          {/* Backglow effect - yellow ATM style */}
          <div className={`
            absolute -inset-0.5 sm:-inset-1 bg-gradient-to-br from-yellow-500/50 via-amber-500/40 to-yellow-400/30 
            ${statusFilter === "pre-integration" ? "opacity-100" : "opacity-0 sm:group-hover:opacity-60"} 
            transition-opacity duration-500 blur-xl sm:blur-2xl
          `} />
          
          <div className="relative z-10">
            <p className="text-xs sm:text-sm text-muted-foreground/80 font-medium">Pre-Integration</p>
            <p className="text-2xl sm:text-3xl font-bold mt-1 sm:mt-2 text-warning drop-shadow-[0_0_8px_rgba(234,179,8,0.3)] sm:drop-shadow-[0_0_12px_rgba(234,179,8,0.4)]">
              {statusCounts.preIntegration}
            </p>
          </div>
        </button>

        {/* Offline */}
        <button
          onClick={() => setStatusFilter("offline")}
          className={`
            relative rounded-xl border border-white/20 p-4 sm:p-5
            backdrop-blur-md bg-gradient-to-br from-red-500/10 to-rose-500/5
            transition-all duration-300 cursor-pointer
            active:scale-[0.98] sm:hover:scale-[1.02] sm:hover:border-red-400/40
            touch-manipulation
            ${statusFilter === "offline" 
              ? "ring-2 ring-red-500/50 ring-offset-1 sm:ring-offset-2 ring-offset-background shadow-[0_0_20px_rgba(239,68,68,0.5)] sm:shadow-[0_0_30px_rgba(239,68,68,0.6)]" 
              : "shadow-lg sm:hover:shadow-xl"
            }
            overflow-hidden group w-full
          `}
        >
          {/* Backglow effect - red ATM style */}
          <div className={`
            absolute -inset-0.5 sm:-inset-1 bg-gradient-to-br from-red-500/50 via-rose-500/40 to-red-400/30 
            ${statusFilter === "offline" ? "opacity-100" : "opacity-0 sm:group-hover:opacity-60"} 
            transition-opacity duration-500 blur-xl sm:blur-2xl
          `} />
          
          <div className="relative z-10">
            <p className="text-xs sm:text-sm text-muted-foreground/80 font-medium">Offline</p>
            <p className="text-2xl sm:text-3xl font-bold mt-1 sm:mt-2 text-destructive drop-shadow-[0_0_8px_rgba(239,68,68,0.3)] sm:drop-shadow-[0_0_12px_rgba(239,68,68,0.4)]">
              {statusCounts.offline}
            </p>
          </div>
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search MCP servers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 text-sm sm:text-base"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="pre-integration">Pre-Integration</SelectItem>
            <SelectItem value="offline">Offline</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading && (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4"></div>
          <p className="text-muted-foreground">Loading servers from backend...</p>
          <p className="text-muted-foreground text-sm mt-2">
            If this takes too long, check:
            <br />1. Backend is running on http://localhost:3001
            <br />2. Open browser console (F12) for errors
            <br />3. Check Network tab for failed requests
          </p>
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
              <p className="text-muted-foreground">No MCP servers found matching your filters.</p>
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

