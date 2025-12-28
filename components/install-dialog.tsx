"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Copy, Download, Check, Loader2, ExternalLink } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { getInstallConfig } from "@/lib/api"
import type { MCPServer } from "@/lib/api"

export type InstallClient = "claude-desktop" | "cursor" | "windsurf" | "cli"

interface InstallDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  server: MCPServer | null
  client: InstallClient
}

const clientNames: Record<InstallClient, string> = {
  "claude-desktop": "Claude Desktop",
  cursor: "Cursor",
  windsurf: "Windsurf",
  cli: "CLI",
}

export function InstallDialog({ open, onOpenChange, server, client }: InstallDialogProps) {
  const [config, setConfig] = useState<string>("")
  const [instructions, setInstructions] = useState<string>("")
  const [filePath, setFilePath] = useState<string>("")
  const [isLoading, setIsLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    if (open && server) {
      fetchInstallConfig()
    }
  }, [open, server, client])

  const fetchInstallConfig = async () => {
    if (!server) return

    setIsLoading(true)
    try {
      const response = await getInstallConfig(server.serverId, client)
      setConfig(response.config)
      setInstructions(response.instructions)
      setFilePath(response.filePath || "")
    } catch (error) {
      console.error("Error fetching install config:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to generate install configuration",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(config)
      setCopied(true)
      toast({
        title: "Copied!",
        description: "Configuration copied to clipboard",
      })
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      toast({
        title: "Copy failed",
        description: "Failed to copy to clipboard",
        variant: "destructive",
      })
    }
  }

  const handleDownload = () => {
    if (!server) return

    const blob = new Blob([config], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${server.serverId.replace(/\//g, "-")}-${client}-config.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    toast({
      title: "Downloaded!",
      description: "Configuration file downloaded",
    })
  }

  if (!server) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="text-2xl">Install in {clientNames[client]}</DialogTitle>
          <DialogDescription>{server.name}</DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Instructions */}
            {instructions && (
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <h3 className="text-sm font-semibold mb-2">Installation Instructions</h3>
                <div className="text-sm text-muted-foreground whitespace-pre-line">{instructions}</div>
                {filePath && (
                  <div className="mt-3 p-2 rounded bg-background border border-border">
                    <p className="text-xs text-muted-foreground mb-1">Config file location:</p>
                    <code className="text-xs font-mono break-all">{filePath}</code>
                  </div>
                )}
              </div>
            )}

            {/* Configuration */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold">Configuration</h3>
                <div className="flex gap-2">
                  {client === "cli" ? (
                    <Button variant="outline" size="sm" onClick={handleCopy}>
                      {copied ? (
                        <>
                          <Check className="h-4 w-4 mr-2" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="h-4 w-4 mr-2" />
                          Copy Command
                        </>
                      )}
                    </Button>
                  ) : (
                    <>
                      <Button variant="outline" size="sm" onClick={handleCopy}>
                        {copied ? (
                          <>
                            <Check className="h-4 w-4 mr-2" />
                            Copied
                          </>
                        ) : (
                          <>
                            <Copy className="h-4 w-4 mr-2" />
                            Copy
                          </>
                        )}
                      </Button>
                      <Button variant="outline" size="sm" onClick={handleDownload}>
                        <Download className="h-4 w-4 mr-2" />
                        Download
                      </Button>
                    </>
                  )}
                </div>
              </div>
              <ScrollArea className="h-[300px] rounded-lg border border-border bg-muted/30 p-4">
                <pre className="text-xs font-mono whitespace-pre-wrap break-words">{config}</pre>
              </ScrollArea>
            </div>

            {/* Additional Help */}
            <div className="text-xs text-muted-foreground">
              <p>
                Need help? Check the{" "}
                <a
                  href="https://modelcontextprotocol.io/docs"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline inline-flex items-center gap-1"
                >
                  MCP Documentation
                  <ExternalLink className="h-3 w-3" />
                </a>
              </p>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}














