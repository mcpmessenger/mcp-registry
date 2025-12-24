"use client"

import { useState, useEffect, useRef } from "react"
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
  const recognitionRef = useRef<any>(null)

  useEffect(() => {
    if (!open) {
      setIsRecording(false)
      setTranscript("")
      setRecordingTime(0)
      // Stop recognition if it's still running
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop()
          recognitionRef.current = null
        } catch (e) {
          // Ignore errors when stopping
        }
      }
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

    // Check if browser supports Web Speech API
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      setTranscript("Error: Your browser doesn't support speech recognition. Please use Chrome, Edge, or Safari.")
      setIsRecording(false)
      return
    }

    // Use Web Speech API for real-time transcription
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    const recognition = new SpeechRecognition()
    
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-US'

    recognition.onstart = () => {
      console.log('Speech recognition started')
    }

    recognition.onresult = (event: any) => {
      let interimTranscript = ''
      let finalTranscript = ''

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript
        if (event.results[i].isFinal) {
          finalTranscript += transcript + ' '
        } else {
          interimTranscript += transcript
        }
      }

      setTranscript(finalTranscript || interimTranscript)
    }

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error)
      if (event.error === 'no-speech') {
        setTranscript("No speech detected. Please try again.")
      } else if (event.error === 'audio-capture') {
        setTranscript("No microphone found. Please check your microphone settings.")
      } else if (event.error === 'not-allowed') {
        setTranscript("Microphone permission denied. Please allow microphone access.")
      } else {
        setTranscript(`Error: ${event.error}. Please try again.`)
      }
      setIsRecording(false)
    }

    recognition.onend = () => {
      setIsRecording(false)
    }

    try {
      recognition.start()
      // Store recognition instance in ref to stop it later
      recognitionRef.current = recognition
    } catch (error) {
      console.error('Failed to start recognition:', error)
      setTranscript("Failed to start speech recognition. Please try again.")
      setIsRecording(false)
    }
  }

  const handleStopRecording = () => {
    setIsRecording(false)
    // Stop recognition if it's active
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop()
        recognitionRef.current = null
      } catch (e) {
        // Ignore errors when stopping
      }
    }
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
