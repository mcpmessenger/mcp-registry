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

interface InstallButtonProps {
  server: MCPServer
}

export function InstallButton({ server }: InstallButtonProps) {
  const [selectedClient, setSelectedClient] = useState<InstallClient | null>(null)
  const [showInstallDialog, setShowInstallDialog] = useState(false)
  const [showPermissionsDialog, setShowPermissionsDialog] = useState(false)
  const [permissions, setPermissions] = useState<ServerPermissions | null>(null)

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
      setShowInstallDialog(true)
    }
  }

  const handlePermissionsConfirm = () => {
    setShowPermissionsDialog(false)
    if (selectedClient) {
      setShowInstallDialog(true)
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
          <DropdownMenuItem onClick={() => handleClientSelect("claude-desktop")}>
            <Download className="h-4 w-4 mr-2" />
            Install in Claude Desktop
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleClientSelect("cursor")}>
            <Download className="h-4 w-4 mr-2" />
            Install in Cursor
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

