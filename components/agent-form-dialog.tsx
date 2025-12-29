"use client"

import type React from "react"

import { useState } from "react"
import type { MCPAgent } from "@/types/agent"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Loader2, ExternalLink } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

interface AgentFormDialogProps {
  agent?: MCPAgent | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (data: Partial<MCPAgent>) => void
}

// Provider-specific configuration
interface ProviderConfig {
  name: string
  httpHeaderKey?: string
  httpHeaderPlaceholder?: string
  httpHeaderInstructions?: string
  envVarKey?: string
  envVarInstructions?: string
  docsUrl?: string
  serverUrl?: string
}

function getProviderConfig(agent: MCPAgent | null | undefined): ProviderConfig | null {
  if (!agent?.metadata || typeof agent.metadata !== 'object') {
    return null
  }
  
  const metadata = agent.metadata as Record<string, unknown>
  const serverId = agent.id.toLowerCase()
  const name = agent.name.toLowerCase()
  
  // Google Maps
  if (serverId.includes('google') || serverId.includes('maps') || name.includes('google maps')) {
    return {
      name: 'Google Maps',
      httpHeaderKey: 'X-Goog-Api-Key',
      httpHeaderPlaceholder: 'AIza... (your Google Maps API key)',
      httpHeaderInstructions: 'Get your API key from Google Cloud Console. Enable Maps Grounding Lite API.',
      docsUrl: metadata.documentation as string || 'https://developers.google.com/maps/ai/grounding-lite',
      serverUrl: metadata.endpoint as string || 'https://mapstools.googleapis.com/mcp',
    }
  }
  
  // Exa
  if (serverId.includes('exa') || name.includes('exa')) {
    return {
      name: 'Exa',
      httpHeaderKey: 'Authorization',
      httpHeaderPlaceholder: 'Bearer YOUR_EXA_API_KEY (optional)',
      httpHeaderInstructions: 'Optional: Exa API key for authenticated requests. Get from https://dashboard.exa.ai',
      envVarKey: 'EXA_API_KEY',
      docsUrl: metadata.documentation as string || 'https://github.com/exa-labs/exa-mcp-server',
      serverUrl: metadata.endpoint as string || 'https://mcp.exa.ai/mcp',
    }
  }
  
  // GitHub
  if (serverId.includes('github') || name.includes('github')) {
    return {
      name: 'GitHub',
      envVarKey: 'GITHUB_PERSONAL_ACCESS_TOKEN',
      envVarInstructions: 'Create a personal access token with repo permissions at https://github.com/settings/tokens',
      docsUrl: metadata.documentation as string || 'https://github.com/modelcontextprotocol/servers/tree/main/src/github',
      serverUrl: metadata.npmPackage ? `https://www.npmjs.com/package/${metadata.npmPackage}` : undefined,
    }
  }
  
  // Generic - extract from metadata
  return {
    name: (metadata.publisher as string) || 'MCP Server',
    httpHeaderKey: undefined,
    httpHeaderPlaceholder: '{"Header-Name": "value"}',
    httpHeaderInstructions: 'Enter HTTP headers as JSON object',
    envVarKey: undefined,
    envVarInstructions: 'Enter environment variables as JSON object',
    docsUrl: metadata.documentation as string,
    serverUrl: metadata.endpoint as string || (metadata.npmPackage ? `https://www.npmjs.com/package/${metadata.npmPackage}` : undefined),
  }
}

export function AgentFormDialog({ agent, open, onOpenChange, onSave }: AgentFormDialogProps) {
  // Determine server type from agent
  // Check if endpoint starts with stdio:// (STDIO) OR if metadata has endpoint (HTTP)
  let initialServerType: "http" | "stdio" = "http"
  let initialEndpoint = ""
  
  if (agent) {
    if (agent.endpoint?.startsWith('stdio://')) {
      initialServerType = "stdio"
      initialEndpoint = ""
    } else if (agent.endpoint && !agent.endpoint.startsWith('stdio://')) {
      initialServerType = "http"
      initialEndpoint = agent.endpoint
    } else if (agent.metadata && typeof agent.metadata === 'object') {
      const metadata = agent.metadata as Record<string, unknown>
      if (metadata.endpoint && typeof metadata.endpoint === 'string') {
        initialServerType = "http"
        initialEndpoint = metadata.endpoint
      }
    }
  }
  
  const providerConfig = getProviderConfig(agent)
  
  const [serverType, setServerType] = useState<"http" | "stdio">(initialServerType)
  
  const [formData, setFormData] = useState({
    name: agent?.name || "",
    endpoint: initialEndpoint,
    command: "",
    args: "",
    credentials: "", // Unified credentials field (JSON or simple key)
    httpHeaders: agent?.httpHeaders || "", // HTTP headers for HTTP servers (JSON object)
  })
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)

  const isEditing = !!agent

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setShowConfirmDialog(true)
  }

  const handleConfirmedSave = () => {
    // Pass all form data including server type-specific fields
    onSave({
      ...formData,
      // Add server type indicator
      ...(serverType === "stdio" ? { 
        command: formData.command,
        args: formData.args,
        credentials: formData.credentials,
        endpoint: undefined, // Clear endpoint for STDIO
        httpHeaders: undefined, // Clear httpHeaders for STDIO
      } : {
        endpoint: formData.endpoint,
        credentials: formData.credentials,
        httpHeaders: formData.httpHeaders, // Include httpHeaders for HTTP servers
        command: undefined, // Clear command/args for HTTP
        args: undefined,
      }),
    })
    setShowConfirmDialog(false)
    onOpenChange(false)
    // Reset form
    setFormData({
      name: "",
      endpoint: "",
      command: "",
      args: "",
      credentials: "",
      httpHeaders: "",
    })
    setServerType("http")
  }


  const validateCredentials = (creds: string): boolean => {
    if (!creds.trim()) return true // Optional field
    // Try to parse as JSON, if fails, assume it's a simple API key
    try {
      const parsed = JSON.parse(creds)
      return typeof parsed === 'object' && !Array.isArray(parsed)
    } catch {
      return true // Simple API key is fine
    }
  }

  const validateArgs = (args: string): boolean => {
    if (!args.trim()) return false
    try {
      const parsed = JSON.parse(args)
      return Array.isArray(parsed)
    } catch {
      return false
    }
  }

  const isFormValid =
    formData.name.trim() !== "" &&
    validateCredentials(formData.credentials) &&
    (serverType === "http" 
      ? formData.endpoint.trim() !== ""
      : formData.command.trim() !== "" && validateArgs(formData.args))

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isEditing ? "Edit MCP Server" : "Add New MCP Server"}</DialogTitle>
            <DialogDescription>
              {isEditing
                ? "Update the configuration for this MCP server."
                : "Register a new Model Context Protocol server to the registry."}
            </DialogDescription>
            {providerConfig && (providerConfig.docsUrl || providerConfig.serverUrl) && (
              <div className="flex flex-wrap gap-2 mt-2">
                {providerConfig.docsUrl && (
                  <a
                    href={providerConfig.docsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline flex items-center gap-1"
                  >
                    <ExternalLink className="h-3 w-3" />
                    Documentation
                  </a>
                )}
                {providerConfig.serverUrl && (
                  <a
                    href={providerConfig.serverUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline flex items-center gap-1"
                  >
                    <ExternalLink className="h-3 w-3" />
                    {providerConfig.serverUrl.includes('npmjs.com') ? 'npm Package' : 'Server URL'}
                  </a>
                )}
              </div>
            )}
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="name">Server Name *</Label>
              <Input
                id="name"
                placeholder="e.g., GitHub MCP Server"
                value={formData.name}
                onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="serverType">Server Type *</Label>
              <Select value={serverType} onValueChange={(value: "http" | "stdio") => setServerType(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="http">HTTP Server (Endpoint URL)</SelectItem>
                  <SelectItem value="stdio">STDIO Server (Command/Args)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {serverType === "http" 
                  ? "HTTP servers use endpoint URLs for communication"
                  : "STDIO servers run as processes and communicate via stdin/stdout"}
              </p>
            </div>

            {serverType === "http" ? (
              <div className="space-y-2">
                <Label htmlFor="endpoint">Endpoint URL *</Label>
                <Input
                  id="endpoint"
                  type="url"
                  placeholder="https://mcp.example.com/api"
                  value={formData.endpoint}
                  onChange={(e) => setFormData((prev) => ({ ...prev, endpoint: e.target.value }))}
                  required
                />
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="command">Command *</Label>
                  <Input
                    id="command"
                    placeholder="npx"
                    value={formData.command}
                    onChange={(e) => setFormData((prev) => ({ ...prev, command: e.target.value }))}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="args">Arguments (JSON Array) *</Label>
                  <Input
                    id="args"
                    placeholder='["nano-banana-mcp"]'
                    value={formData.args}
                    onChange={(e) => setFormData((prev) => ({ ...prev, args: e.target.value }))}
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    JSON array format: ["package-name"] or ["-y", "@package/name"]
                  </p>
                </div>
              </>
            )}

            {serverType === "http" ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="httpHeaders">
                    HTTP Headers
                    {providerConfig?.httpHeaderKey && ` (${providerConfig.name})`}
                    {!providerConfig?.httpHeaderKey && " (Optional)"}
                  </Label>
                  <Textarea
                    id="httpHeaders"
                    placeholder={
                      providerConfig?.httpHeaderPlaceholder || 
                      '{"Header-Name": "value"} or paste API key (will auto-format)'
                    }
                    value={formData.httpHeaders}
                    onChange={(e) => {
                      let value = e.target.value.trim()
                      // Auto-wrap plain API key in JSON format if it's not already JSON
                      if (value && !value.startsWith('{') && !value.startsWith('[')) {
                        // Auto-detect provider-specific API keys
                        if (providerConfig?.httpHeaderKey) {
                          const headerObj: Record<string, string> = {}
                          headerObj[providerConfig.httpHeaderKey] = value
                          value = JSON.stringify(headerObj, null, 2)
                        } else if (value.startsWith('AIza')) {
                          // Google Maps API key
                          value = JSON.stringify({ "X-Goog-Api-Key": value }, null, 2)
                        } else if (value.startsWith('Bearer ') || value.startsWith('bearer ')) {
                          // Bearer token
                          value = JSON.stringify({ "Authorization": value }, null, 2)
                        }
                      }
                      setFormData((prev) => ({ ...prev, httpHeaders: value }))
                    }}
                    className="font-mono text-xs min-h-[80px]"
                  />
                  <p className="text-xs text-muted-foreground">
                    {providerConfig?.httpHeaderInstructions || 
                      "HTTP headers to send with requests. Enter as JSON object or paste API key (will auto-format)."}
                    {providerConfig?.docsUrl && (
                      <span className="block mt-1">
                        <a href={providerConfig.docsUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                          View {providerConfig.name} documentation →
                        </a>
                      </span>
                    )}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="credentials">
                    Environment Variables
                    {providerConfig?.envVarKey && ` (${providerConfig.name})`}
                    {!providerConfig?.envVarKey && " (Optional, for STDIO servers only)"}
                  </Label>
                  <Textarea
                    id="credentials"
                    placeholder={
                      providerConfig?.envVarKey 
                        ? `{"${providerConfig.envVarKey}": "your-key-here"}`
                        : '{"API_KEY": "value"} JSON format'
                    }
                    value={formData.credentials}
                    onChange={(e) => setFormData((prev) => ({ ...prev, credentials: e.target.value }))}
                    className="font-mono text-xs min-h-[80px]"
                  />
                  <p className="text-xs text-muted-foreground">
                    {providerConfig?.envVarInstructions || 
                      "Environment variables for STDIO servers. Not used for HTTP servers (use HTTP Headers above instead)."}
                    {providerConfig?.docsUrl && !providerConfig.httpHeaderKey && (
                      <span className="block mt-1">
                        <a href={providerConfig.docsUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                          View {providerConfig.name} documentation →
                        </a>
                      </span>
                    )}
                  </p>
                </div>
              </>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="credentials">
                  Environment Variables
                  {providerConfig?.envVarKey && ` (${providerConfig.name})`}
                  {!providerConfig?.envVarKey && " (Optional)"}
                </Label>
                <Textarea
                  id="credentials"
                  placeholder={
                    providerConfig?.envVarKey 
                      ? `{"${providerConfig.envVarKey}": "your-key-here"} or just paste API key`
                      : '{"API_KEY": "your-key-here"} or just paste API key'
                  }
                  value={formData.credentials}
                  onChange={(e) => {
                    let value = e.target.value.trim()
                    // Auto-wrap plain API key if provider config specifies a key
                    if (value && !value.startsWith('{') && !value.startsWith('[') && providerConfig?.envVarKey) {
                      const envObj: Record<string, string> = {}
                      envObj[providerConfig.envVarKey] = value
                      value = JSON.stringify(envObj, null, 2)
                      setFormData((prev) => ({ ...prev, credentials: value }))
                    } else {
                      setFormData((prev) => ({ ...prev, credentials: value }))
                    }
                  }}
                  className="font-mono text-xs min-h-[80px]"
                />
                <p className="text-xs text-muted-foreground">
                  {providerConfig?.envVarInstructions || 
                    "Environment variables as JSON object, or a simple API key (will be auto-formatted)."}
                  {providerConfig?.docsUrl && (
                    <span className="block mt-1">
                      <a href={providerConfig.docsUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                        View {providerConfig.name} documentation →
                      </a>
                    </span>
                  )}
                </p>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4 border-t border-border">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={!isFormValid}>
                {isEditing ? "Save Changes" : "Register MCP Server"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm {isEditing ? "Update" : "Registration"}</AlertDialogTitle>
            <AlertDialogDescription>
              {isEditing
                ? `Are you sure you want to update the configuration for "${formData.name}"?`
                : `Are you sure you want to register "${formData.name}" to SlashMCP.com?`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmedSave}>Confirm</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
