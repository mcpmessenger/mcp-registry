"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Download, ChevronDown } from "lucide-react"
import type { MCPServer } from "@/lib/api"
import type { InstallClient } from "./install-dialog"
import { InstallDialog } from "./install-dialog"
import { InstallPermissionsDialog } from "./install-permissions-dialog"
import { getServerPermissions } from "@/lib/api"
import type { ServerPermissions } from "./install-permissions-dialog"
import { useToast } from "@/hooks/use-toast"
import { copyToClipboard } from "@/lib/utils"

interface InstallButtonProps {
  server: MCPServer
}

export function InstallButton({ server }: InstallButtonProps) {
  const [selectedClient, setSelectedClient] = useState<InstallClient | null>(null)
  const [showInstallDialog, setShowInstallDialog] = useState(false)
  const [showPermissionsDialog, setShowPermissionsDialog] = useState(false)
  const [permissions, setPermissions] = useState<ServerPermissions | null>(null)
  const { toast } = useToast()

  const handleClientSelect = async (client: InstallClient) => {
    // First show permissions dialog
    try {
      const perms = await getServerPermissions(server.serverId)
      setPermissions(perms)
      setShowPermissionsDialog(true)
      setSelectedClient(client)
    } catch (error) {
      console.error("Error fetching permissions:", error)
      // If permissions fetch fails, proceed anyway
      setSelectedClient(client)
      // For Cursor and Claude Desktop, try to install directly
      if (client === "cursor" || client === "claude-desktop") {
        handleInstall(client)
      } else {
        // For other clients, show the generic dialog
        setShowInstallDialog(true)
      }
    }
  }

  const handleInstall = async (client: InstallClient) => {
    // Validate that server has a command field
    if (!server.command) {
      toast({
        title: "Cannot install",
        description: "This server is HTTP-based and cannot be installed via one-click. Only STDIO servers (with commands) can be installed this way. Use the generic install dialog for manual configuration.",
        variant: "destructive",
      })
      return
    }

    if (client === "cursor") {
      // Construct Cursor deep-link URI
      const config = {
        name: server.name,
        command: server.command,
        args: server.args || [],
        env: server.env || {},
      }
      
      // Base64 encode the config
      const configJson = JSON.stringify(config)
      const configBase64 = btoa(configJson)
      const deepLink = `cursor://mcp/install?config=${encodeURIComponent(configBase64)}`
      
      // Navigate to the deep-link
      window.location.href = deepLink
      
      toast({
        title: "Opening Cursor",
        description: "Attempting to install server in Cursor...",
      })
    } else if (client === "claude-desktop") {
      // Construct Claude Desktop config JSON
      const claudeConfig = {
        mcpServers: {
          [server.serverId]: {
            command: server.command,
            args: server.args || [],
            env: server.env || {},
          },
        },
      }
      
      const configJson = JSON.stringify(claudeConfig, null, 2)
      
      // Copy to clipboard
      const success = await copyToClipboard(configJson)
      
      if (success) {
        toast({
          title: "Config copied to clipboard!",
          description: "Paste it into your Claude Desktop config file.",
        })
      } else {
        toast({
          title: "Copy failed",
          description: "Failed to copy configuration to clipboard.",
          variant: "destructive",
        })
      }
    } else {
      // For other clients (windsurf, cli), show the generic dialog
      setShowInstallDialog(true)
    }
  }

  const handlePermissionsConfirm = () => {
    setShowPermissionsDialog(false)
    if (selectedClient) {
      // For Cursor and Claude Desktop, bypass the dialog and install directly
      if (selectedClient === "cursor" || selectedClient === "claude-desktop") {
        handleInstall(selectedClient)
      } else {
        // For other clients, show the generic dialog
        setShowInstallDialog(true)
      }
    }
  }

  const handlePermissionsCancel = () => {
    setShowPermissionsDialog(false)
    setSelectedClient(null)
  }

  const handleInstallDialogClose = (open: boolean) => {
    setShowInstallDialog(open)
    if (!open) {
      setSelectedClient(null)
    }
  }

  // Check if server is STDIO-based (has command) or HTTP-based
  const isStdioServer = !!server.command
  const isHttpServer = !server.command

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="default" size="sm" className="gap-2">
            <Download className="h-4 w-4" />
            Install
            <ChevronDown className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem 
            onClick={() => handleClientSelect("claude-desktop")}
            disabled={isHttpServer}
            className={isHttpServer ? "opacity-50 cursor-not-allowed" : ""}
          >
            <Download className="h-4 w-4 mr-2" />
            Install in Claude Desktop
            {isHttpServer && <span className="ml-auto text-xs text-muted-foreground">(STDIO only)</span>}
          </DropdownMenuItem>
          <DropdownMenuItem 
            onClick={() => handleClientSelect("cursor")}
            disabled={isHttpServer}
            className={isHttpServer ? "opacity-50 cursor-not-allowed" : ""}
          >
            <Download className="h-4 w-4 mr-2" />
            Install in Cursor
            {isHttpServer && <span className="ml-auto text-xs text-muted-foreground">(STDIO only)</span>}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleClientSelect("windsurf")}>
            <Download className="h-4 w-4 mr-2" />
            Install in Windsurf
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleClientSelect("cli")}>
            <Download className="h-4 w-4 mr-2" />
            CLI Command
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {permissions && (
        <InstallPermissionsDialog
          open={showPermissionsDialog}
          onOpenChange={setShowPermissionsDialog}
          serverName={server.name}
          permissions={permissions}
          onConfirm={handlePermissionsConfirm}
          onCancel={handlePermissionsCancel}
        />
      )}

      {selectedClient && (
        <InstallDialog
          open={showInstallDialog}
          onOpenChange={handleInstallDialogClose}
          server={server}
          client={selectedClient}
        />
      )}
    </>
  )
}

