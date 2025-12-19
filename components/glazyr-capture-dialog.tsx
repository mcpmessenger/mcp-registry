"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Monitor, Camera, Loader2 } from "lucide-react"

interface GlazyrCaptureDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCapture: () => void
}

export function GlazyrCaptureDialog({ open, onOpenChange, onCapture }: GlazyrCaptureDialogProps) {
  const [isCapturing, setIsCapturing] = useState(false)

  const handleCapture = async () => {
    setIsCapturing(true)

    // Simulate Glazyr capture
    await new Promise((resolve) => setTimeout(resolve, 1500))

    onCapture()
    setIsCapturing(false)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Glazyr Screen Capture</DialogTitle>
          <DialogDescription>Capture your current screen context for AI analysis</DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-6">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="rounded-full bg-secondary/20 p-6">
              <Monitor className="h-12 w-12 text-secondary" />
            </div>

            {isCapturing ? (
              <>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Capturing screen context...</span>
                  </div>
                  <p className="text-xs text-muted-foreground">This may take a few seconds</p>
                </div>
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <p className="text-sm font-medium">Ready to capture</p>
                  <p className="text-xs text-muted-foreground">
                    The current visual state of your screen will be sent to the agent for analysis
                  </p>
                </div>

                <Button onClick={handleCapture} size="lg" className="gap-2">
                  <Camera className="h-4 w-4" />
                  Capture Screen
                </Button>
              </>
            )}
          </div>

          <div className="rounded-lg bg-muted/50 p-4 space-y-2">
            <p className="text-xs font-medium">About Glazyr Integration</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Glazyr captures your current screen context including visible applications, windows, and content. This
              visual context is processed and sent to the Vision Agent for intelligent analysis.
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isCapturing}>
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
