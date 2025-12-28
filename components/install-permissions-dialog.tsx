"use client"

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { AlertTriangle, Shield, FileText, Globe, Monitor, Terminal } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

export interface ServerPermissions {
  capabilities: string[]
  tools: Array<{
    name: string
    description: string
    permissions: string[]
  }>
  warnings: string[]
}

interface InstallPermissionsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  serverName: string
  permissions: ServerPermissions | null
  onConfirm: () => void
  onCancel: () => void
}

const permissionIcons: Record<string, React.ReactNode> = {
  "File System Access": <FileText className="h-4 w-4" />,
  "Network Access": <Globe className="h-4 w-4" />,
  "Browser Control": <Monitor className="h-4 w-4" />,
  "Command Execution": <Terminal className="h-4 w-4" />,
  "Environment Variables": <Shield className="h-4 w-4" />,
}

export function InstallPermissionsDialog({
  open,
  onOpenChange,
  serverName,
  permissions,
  onConfirm,
  onCancel,
}: InstallPermissionsDialogProps) {
  if (!permissions) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="text-2xl flex items-center gap-2">
            <Shield className="h-6 w-6" />
            Server Permissions Review
          </DialogTitle>
          <DialogDescription>
            Review what <strong>{serverName}</strong> can do before installing
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(85vh-180px)]">
          <div className="space-y-6 pr-4">
            {/* Warnings */}
            {permissions.warnings.length > 0 && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Security Warnings:</strong>
                  <ul className="list-disc list-inside mt-2 space-y-1">
                    {permissions.warnings.map((warning, idx) => (
                      <li key={idx} className="text-sm">
                        {warning}
                      </li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {/* Capabilities */}
            <div>
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Capabilities
              </h3>
              <div className="flex flex-wrap gap-2">
                {permissions.capabilities.length > 0 ? (
                  permissions.capabilities.map((capability) => (
                    <Badge key={capability} variant="secondary">
                      {capability}
                    </Badge>
                  ))
                ) : (
                  <span className="text-sm text-muted-foreground">No special capabilities</span>
                )}
              </div>
            </div>

            {/* Tools and Permissions */}
            <div>
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Terminal className="h-4 w-4" />
                Tools & Permissions ({permissions.tools.length})
              </h3>
              <div className="space-y-4">
                {permissions.tools.map((tool, idx) => (
                  <div key={idx} className="rounded-lg border border-border bg-muted/30 p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h4 className="font-medium text-sm">{tool.name}</h4>
                        <p className="text-xs text-muted-foreground mt-1">{tool.description}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-3">
                      {tool.permissions.map((permission) => (
                        <Badge
                          key={permission}
                          variant="outline"
                          className="text-xs flex items-center gap-1.5"
                        >
                          {permissionIcons[permission] || <Shield className="h-3 w-3" />}
                          {permission}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </ScrollArea>

        <div className="flex justify-end gap-3 pt-4 border-t">
          <button
            onClick={() => {
              onCancel()
              onOpenChange(false)
            }}
            className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onConfirm()
              onOpenChange(false)
            }}
            className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
          >
            Continue Installation
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}














