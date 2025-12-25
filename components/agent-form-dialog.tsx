"use client"

import type React from "react"

import { useState } from "react"
import type { MCPAgent } from "@/types/agent"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Loader2 } from "lucide-react"
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

export function AgentFormDialog({ agent, open, onOpenChange, onSave }: AgentFormDialogProps) {
  // Determine server type from agent or default to HTTP
  const isStdioServer = agent?.endpoint?.startsWith('stdio://') || false
  const [serverType, setServerType] = useState<"http" | "stdio">(isStdioServer ? "stdio" : "http")
  
  const [formData, setFormData] = useState({
    name: agent?.name || "",
    endpoint: agent?.endpoint?.replace('stdio://', '') || "",
    command: "",
    args: "",
    credentials: "", // Unified credentials field (JSON or simple key)
    httpHeaders: "", // HTTP headers for HTTP servers (JSON object)
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
      } : {
        endpoint: formData.endpoint,
        credentials: formData.credentials,
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
            <DialogTitle>{isEditing ? "Edit MCP Agent" : "Add New MCP Agent"}</DialogTitle>
            <DialogDescription>
              {isEditing
                ? "Update the configuration for this MCP agent."
                : "Register a new Model Context Protocol agent to the registry."}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="name">Agent Name *</Label>
              <Input
                id="name"
                placeholder="e.g., Vision Agent"
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
                  placeholder="https://agent.example.com/api"
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
                  <Label htmlFor="httpHeaders">HTTP Headers (JSON, Optional)</Label>
                  <Textarea
                    id="httpHeaders"
                    placeholder='{"X-Goog-Api-Key": "your-api-key-here"}'
                    value={formData.httpHeaders}
                    onChange={(e) => setFormData((prev) => ({ ...prev, httpHeaders: e.target.value }))}
                    className="font-mono text-xs min-h-[80px]"
                  />
                  <p className="text-xs text-muted-foreground">
                    HTTP headers to send with requests (e.g., API keys). Must be valid JSON object.
                    Example: {"{"}"X-Goog-Api-Key": "your-key"{"}"}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="credentials">Credentials/Env Vars (Optional)</Label>
                  <Textarea
                    id="credentials"
                    placeholder='API key or {"API_KEY": "value"} JSON'
                    value={formData.credentials}
                    onChange={(e) => setFormData((prev) => ({ ...prev, credentials: e.target.value }))}
                    className="font-mono text-xs min-h-[80px]"
                  />
                  <p className="text-xs text-muted-foreground">
                    Environment variables (if server needs them). Not used for HTTP requests.
                  </p>
                </div>
              </>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="credentials">Credentials (Optional)</Label>
                <Textarea
                  id="credentials"
                  placeholder='{"GEMINI_API_KEY": "your-key-here"} or just paste API key'
                  value={formData.credentials}
                  onChange={(e) => setFormData((prev) => ({ ...prev, credentials: e.target.value }))}
                  className="font-mono text-xs min-h-[80px]"
                />
                <p className="text-xs text-muted-foreground">
                  Environment variables as JSON object, or a simple API key (will be mapped to GEMINI_API_KEY for Nano-Banana)
                </p>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4 border-t border-border">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={!isFormValid}>
                {isEditing ? "Save Changes" : "Register Agent"}
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
