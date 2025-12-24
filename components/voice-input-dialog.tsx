"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { VoiceVisualizer } from "@/components/voice-visualizer"
import { Mic, MicOff } from "lucide-react"

interface VoiceInputDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onTranscript: (text: string) => void
}

export function VoiceInputDialog({ open, onOpenChange, onTranscript }: VoiceInputDialogProps) {
  const [isRecording, setIsRecording] = useState(false)
  const [transcript, setTranscript] = useState("")
  const [recordingTime, setRecordingTime] = useState(0)

  useEffect(() => {
    if (!open) {
      setIsRecording(false)
      setTranscript("")
      setRecordingTime(0)
    }
  }, [open])

  useEffect(() => {
    if (!isRecording) return

    const interval = setInterval(() => {
      setRecordingTime((prev) => prev + 1)
    }, 1000)

    return () => clearInterval(interval)
  }, [isRecording])

  const handleStartRecording = () => {
    setIsRecording(true)
    setTranscript("")

    // Simulate STT - in production, this would use Web Speech API or a backend service
    setTimeout(() => {
      setTranscript("Transcribing your speech...")
    }, 1000)

    setTimeout(() => {
      const sampleTranscript = "Can you analyze the data in this document and provide key insights?"
      setTranscript(sampleTranscript)
    }, 3000)
  }

  const handleStopRecording = () => {
    setIsRecording(false)
  }

  const handleUseTranscript = () => {
    if (transcript) {
      onTranscript(transcript)
      onOpenChange(false)
    }
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Voice Input</DialogTitle>
          <DialogDescription>
            {isRecording ? "Speak clearly into your microphone" : "Click the microphone to start recording"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <VoiceVisualizer isActive={isRecording} />

          <div className="flex flex-col items-center gap-4">
            {isRecording ? (
              <>
                <div className="text-2xl font-mono text-destructive">{formatTime(recordingTime)}</div>
                <Button
                  onClick={handleStopRecording}
                  size="lg"
                  variant="destructive"
                  className="rounded-full h-16 w-16"
                >
                  <MicOff className="h-6 w-6" />
                </Button>
                <p className="text-sm text-muted-foreground">Click to stop recording</p>
              </>
            ) : (
              <>
                <Button
                  onClick={handleStartRecording}
                  size="lg"
                  className="rounded-full h-16 w-16 bg-destructive hover:bg-destructive/90"
                >
                  <Mic className="h-6 w-6" />
                </Button>
                <p className="text-sm text-muted-foreground">Click to start recording</p>
              </>
            )}
          </div>

          {transcript && (
            <div className="rounded-lg border border-border bg-muted/30 p-4">
              <p className="text-xs text-muted-foreground mb-2">Transcript:</p>
              <p className="text-sm">{transcript}</p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleUseTranscript} disabled={!transcript || isRecording}>
            Use Transcript
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
