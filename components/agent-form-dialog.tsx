"use client"

import type React from "react"

import { useState, useEffect } from "react"
import type { MCPAgent } from "@/types/agent"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Loader2, Upload } from "lucide-react"
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
  const [formData, setFormData] = useState({
    name: agent?.name || "",
    endpoint: agent?.endpoint || "",
    manifest: agent?.manifest || "",
    apiKey: "",
    httpHeaders: agent?.httpHeaders || "",
  })
  const [isTestingConnection, setIsTestingConnection] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<"idle" | "success" | "error">("idle")
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)

  const isEditing = !!agent

  // Update form data when agent prop changes (e.g., when editing)
  useEffect(() => {
    if (agent) {
      setFormData({
        name: agent.name || "",
        endpoint: agent.endpoint || "",
        manifest: agent.manifest || "",
        apiKey: "", // Never show API key for security
        httpHeaders: agent.httpHeaders || "",
      })
    } else {
      // Reset form when creating new agent
      setFormData({
        name: "",
        endpoint: "",
        manifest: "",
        apiKey: "",
        httpHeaders: "",
      })
    }
    setConnectionStatus("idle")
  }, [agent, open])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setShowConfirmDialog(true)
  }

  const handleConfirmedSave = () => {
    onSave(formData)
    setShowConfirmDialog(false)
    onOpenChange(false)
    // Reset form
    setFormData({
      name: "",
      endpoint: "",
      manifest: "",
      apiKey: "",
    })
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

  const validateHeaders = (headers?: string): boolean => {
    if (!headers || !headers.trim()) return true
    try {
      const parsed = JSON.parse(headers)
      return parsed && typeof parsed === "object"
    } catch {
      return false
    }
  }

  const isFormValid =
    formData.name.trim() !== "" &&
    formData.endpoint.trim() !== "" &&
    formData.manifest.trim() !== "" &&
    validateManifest(formData.manifest) &&
    validateHeaders(formData.httpHeaders)

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

            <div className="space-y-2">
              <Label htmlFor="apiKey">API Key / Credentials *</Label>
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

            <div className="space-y-2">
              <Label htmlFor="httpHeaders">HTTP Headers (JSON, optional)</Label>
              <Textarea
                id="httpHeaders"
                placeholder='{"X-Goog-Api-Key": "your-key"}'
                value={formData.httpHeaders}
                onChange={(e) => setFormData((prev) => ({ ...prev, httpHeaders: e.target.value }))}
                className="font-mono text-xs min-h-[120px]"
              />
              {!validateHeaders(formData.httpHeaders) && (
                <p className="text-xs text-destructive">Headers must be valid JSON object.</p>
              )}
              <p className="text-xs text-muted-foreground">
                These headers are sent with every HTTP MCP request (leave blank for STDIO servers).
                For Google Maps MCP (Grounding Lite), set HTTP Headers to <code className="bg-muted px-1 rounded">{'{"X-Goog-Api-Key": "YOUR_KEY"}'}</code> and ensure the API is enabled:
                https://developers.google.com/maps/ai/grounding-lite
              </p>
            </div>

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
                disabled={!formData.endpoint || isTestingConnection}
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
