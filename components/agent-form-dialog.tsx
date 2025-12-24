"use client"

import type React from "react"

import { useState } from "react"
import type { MCPAgent } from "@/types/agent"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Loader2, Upload } from "lucide-react"
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
    manifest: agent?.manifest || "",
    apiKey: "",
    envVars: "",
  })
  const [isTestingConnection, setIsTestingConnection] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<"idle" | "success" | "error">("idle")
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
        envVars: formData.envVars,
        endpoint: undefined, // Clear endpoint for STDIO
      } : {
        endpoint: formData.endpoint,
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
      manifest: "",
      apiKey: "",
      envVars: "",
    })
    setServerType("http")
    setConnectionStatus("idle")
  }

  const handleTestConnection = async () => {
    setIsTestingConnection(true)
    setConnectionStatus("idle")

    // Simulate connection test
    await new Promise((resolve) => setTimeout(resolve, 2000))

    // Randomly succeed or fail for demo
    const success = Math.random() > 0.3
    setConnectionStatus(success ? "success" : "error")
    setIsTestingConnection(false)
  }

  const handleManifestUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (event) => {
        const content = event.target?.result as string
        setFormData((prev) => ({ ...prev, manifest: content }))
      }
      reader.readAsText(file)
    }
  }

  const validateManifest = (manifest: string): boolean => {
    try {
      JSON.parse(manifest)
      return true
    } catch {
      return false
    }
  }

  const isFormValid =
    formData.name.trim() !== "" &&
    formData.manifest.trim() !== "" &&
    validateManifest(formData.manifest) &&
    (serverType === "http" 
      ? formData.endpoint.trim() !== ""
      : formData.command.trim() !== "" && formData.args.trim() !== "")

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
                  <p className="text-xs text-muted-foreground">
                    The command to execute (e.g., "npx", "node", "python")
                  </p>
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
                    Command arguments as JSON array (e.g., ["nano-banana-mcp"] or ["-y", "@playwright/mcp@latest"])
                  </p>
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label htmlFor="apiKey">API Key / Credentials</Label>
              <Input
                id="apiKey"
                type="password"
                placeholder="Enter API key or credentials"
                value={formData.apiKey}
                onChange={(e) => setFormData((prev) => ({ ...prev, apiKey: e.target.value }))}
                autoComplete="off"
              />
              <p className="text-xs text-muted-foreground">
                Credentials are securely stored and never displayed in the browser.
              </p>
            </div>

            {serverType === "stdio" && (
              <div className="space-y-2">
                <Label htmlFor="envVars">Environment Variables (JSON)</Label>
                <Textarea
                  id="envVars"
                  placeholder='{"GEMINI_API_KEY": "your-key-here"}'
                  value={formData.envVars}
                  onChange={(e) => setFormData((prev) => ({ ...prev, envVars: e.target.value }))}
                  className="font-mono text-xs min-h-[80px]"
                />
                <p className="text-xs text-muted-foreground">
                  Environment variables for STDIO servers (e.g., API keys). Must be valid JSON object.
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="manifest">MCP Manifest (JSON) *</Label>
              <div className="flex gap-2 mb-2">
                <Button type="button" variant="outline" size="sm" className="relative bg-transparent">
                  <Upload className="h-3.5 w-3.5 mr-1.5" />
                  Upload File
                  <input
                    type="file"
                    accept=".json,.yaml,.yml"
                    onChange={handleManifestUpload}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                </Button>
                {validateManifest(formData.manifest) && (
                  <span className="flex items-center text-sm text-success">
                    <span className="h-1.5 w-1.5 rounded-full bg-success mr-2" />
                    Valid JSON
                  </span>
                )}
              </div>
              <Textarea
                id="manifest"
                placeholder='{"name": "Agent Name", "version": "1.0.0", "capabilities": ["vision", "ocr"]}'
                value={formData.manifest}
                onChange={(e) => setFormData((prev) => ({ ...prev, manifest: e.target.value }))}
                className="font-mono text-xs min-h-[180px]"
                required
              />
            </div>

            <div className="flex items-center gap-3 pt-2 pb-1">
              <Button
                type="button"
                variant="outline"
                onClick={handleTestConnection}
                disabled={(serverType === "http" && !formData.endpoint) || (serverType === "stdio" && (!formData.command || !formData.args)) || isTestingConnection}
                className="w-[180px] bg-transparent"
              >
                {isTestingConnection ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Testing...
                  </>
                ) : (
                  "Test Connection"
                )}
              </Button>
              {connectionStatus === "success" && (
                <span className="text-sm text-success flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-success" />
                  Connection successful
                </span>
              )}
              {connectionStatus === "error" && (
                <span className="text-sm text-destructive flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-destructive" />
                  Connection failed
                </span>
              )}
            </div>

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
                : `Are you sure you want to register "${formData.name}" to the MCP Registry?`}
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
