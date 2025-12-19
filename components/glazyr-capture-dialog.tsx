"use client"

import { useState, useRef } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Monitor, Camera, Loader2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface GlazyrCaptureDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCapture: (imageDataUrl: string) => void
}

export function GlazyrCaptureDialog({ open, onOpenChange, onCapture }: GlazyrCaptureDialogProps) {
  const [isCapturing, setIsCapturing] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const { toast } = useToast()

  const handleCapture = async () => {
    try {
      setIsCapturing(true)

      // Check if getDisplayMedia is supported
      if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
        toast({
          title: "Screen capture not supported",
          description: "Your browser doesn't support screen capture. Please use Chrome, Firefox, or Edge.",
          variant: "destructive",
        })
        setIsCapturing(false)
        return
      }

      // Request screen capture - browser will show a picker
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: 'browser', // or 'window', 'monitor'
          cursor: 'always',
        } as MediaTrackConstraints,
        audio: false,
      })

      streamRef.current = stream

      // Show the stream in a video element (hidden)
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()

        // Wait a moment for the video to start
        await new Promise((resolve) => setTimeout(resolve, 500))

        // Capture a frame from the video
        if (canvasRef.current && videoRef.current) {
          const canvas = canvasRef.current
          const video = videoRef.current

          // Set canvas dimensions to match video
          canvas.width = video.videoWidth
          canvas.height = video.videoHeight

          // Draw the video frame to canvas
          const ctx = canvas.getContext('2d')
          if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

            // Convert to data URL (base64 image)
            const imageDataUrl = canvas.toDataURL('image/png')

            // Stop the stream
            stream.getTracks().forEach(track => track.stop())
            streamRef.current = null

            // Call the callback with the captured image
            onCapture(imageDataUrl)
            setIsCapturing(false)
            onOpenChange(false)
          }
        }
      }
    } catch (error: any) {
      console.error('Screen capture error:', error)
      setIsCapturing(false)

      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        toast({
          title: "Screen capture denied",
          description: "Please allow screen sharing to capture your screen.",
          variant: "destructive",
        })
      } else if (error.name === 'NotFoundError') {
        toast({
          title: "No screen found",
          description: "No screen or window was selected for capture.",
          variant: "destructive",
        })
      } else {
        toast({
          title: "Capture failed",
          description: error.message || "Failed to capture screen. Please try again.",
          variant: "destructive",
        })
      }

      // Clean up stream if it exists
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
        streamRef.current = null
      }
    }
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

        {/* Hidden video and canvas elements for screen capture */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          style={{ display: 'none' }}
        />
        <canvas
          ref={canvasRef}
          style={{ display: 'none' }}
        />
      </DialogContent>
    </Dialog>
  )
}
