"use client"

import { useState, useEffect, useRef } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { VoiceVisualizer } from "@/components/voice-visualizer"
import { Mic, MicOff, Loader2 } from "lucide-react"
import { transcribeAudio } from "@/lib/api"
import { useToast } from "@/hooks/use-toast"

interface VoiceInputDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onTranscript: (text: string) => void
}

export function VoiceInputDialog({ open, onOpenChange, onTranscript }: VoiceInputDialogProps) {
  const [isRecording, setIsRecording] = useState(false)
  const [transcript, setTranscript] = useState("")
  const [recordingTime, setRecordingTime] = useState(0)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    if (!open) {
      // Cleanup: stop recording and release media stream
      if (isRecording) {
        handleStopRecording()
      }
      setIsRecording(false)
      setTranscript("")
      setRecordingTime(0)
      setIsTranscribing(false)
      
      // Release media stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
        streamRef.current = null
      }
    }
  }, [open, isRecording])

  useEffect(() => {
    if (!isRecording) return

    const interval = setInterval(() => {
      setRecordingTime((prev) => prev + 1)
    }, 1000)

    return () => clearInterval(interval)
  }, [isRecording])

  const handleStartRecording = async () => {
    try {
      // Check if getUserMedia is supported
      // Try multiple ways to access getUserMedia for better browser compatibility
      let getUserMedia: (constraints: MediaStreamConstraints) => Promise<MediaStream>
      
      // Debug logging
      console.log('Checking microphone support...')
      console.log('navigator.mediaDevices:', navigator.mediaDevices)
      console.log('navigator.mediaDevices?.getUserMedia:', navigator.mediaDevices?.getUserMedia)
      console.log('User agent:', navigator.userAgent)
      
      if (navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function') {
        getUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices)
        console.log('Using navigator.mediaDevices.getUserMedia')
      } else if ((navigator as any).getUserMedia && typeof (navigator as any).getUserMedia === 'function') {
        // Fallback for older browsers
        getUserMedia = (constraints: MediaStreamConstraints) => {
          return new Promise((resolve, reject) => {
            (navigator as any).getUserMedia(constraints, resolve, reject)
          })
        }
        console.log('Using navigator.getUserMedia (legacy)')
      } else if ((navigator as any).webkitGetUserMedia && typeof (navigator as any).webkitGetUserMedia === 'function') {
        // Fallback for older WebKit browsers
        getUserMedia = (constraints: MediaStreamConstraints) => {
          return new Promise((resolve, reject) => {
            (navigator as any).webkitGetUserMedia(constraints, resolve, reject)
          })
        }
        console.log('Using navigator.webkitGetUserMedia (legacy)')
      } else if ((navigator as any).mozGetUserMedia && typeof (navigator as any).mozGetUserMedia === 'function') {
        // Fallback for older Firefox
        getUserMedia = (constraints: MediaStreamConstraints) => {
          return new Promise((resolve, reject) => {
            (navigator as any).mozGetUserMedia(constraints, resolve, reject)
          })
        }
        console.log('Using navigator.mozGetUserMedia (legacy)')
      } else {
        // More detailed error message
        const hasMediaDevices = !!navigator.mediaDevices
        const hasGetUserMedia = !!(navigator.mediaDevices?.getUserMedia)
        const userAgent = navigator.userAgent
        const isSecureContext = window.isSecureContext
        const protocol = window.location.protocol
        const hostname = window.location.hostname
        
        console.error('Microphone API not available:', {
          hasMediaDevices,
          hasGetUserMedia,
          isSecureContext,
          protocol,
          hostname,
          userAgent,
        })
        
        // Provide specific guidance based on the issue
        let errorTitle = "Microphone access unavailable"
        let errorDescription = ""
        
        if (!isSecureContext || protocol === 'http:') {
          // Check if it's a local network IP
          const isLocalNetwork = hostname === 'localhost' || 
                                hostname === '127.0.0.1' ||
                                hostname.startsWith('192.168.') ||
                                hostname.startsWith('172.') ||
                                hostname.startsWith('10.')
          
          if (!isLocalNetwork) {
            errorTitle = "HTTPS required for microphone access"
            errorDescription = "Chrome requires HTTPS to access your microphone. Please access this site over HTTPS, or use localhost:3000 for development."
          } else {
            errorTitle = "Microphone access blocked"
            errorDescription = `Chrome is blocking microphone access on HTTP (${hostname}). Try accessing via localhost:3000 instead, or set up HTTPS.`
          }
        } else {
          errorTitle = "Microphone not supported"
          errorDescription = "Your browser doesn't support microphone access. Please check browser settings or try a different browser."
        }
        
        toast({
          title: errorTitle,
          description: errorDescription,
          variant: "destructive",
        })
        return
      }

      // Note: Chrome requires HTTPS or localhost for getUserMedia
      // However, even on HTTP, navigator.mediaDevices should exist
      // If we got here, getUserMedia exists, so we can proceed
      // The browser will handle the security check and show appropriate errors

      // Request microphone access - this will trigger the browser permission popup
      // The popup appears automatically when getUserMedia is called from a user gesture (button click)
      console.log('Requesting microphone access...')
      const stream = await getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      })
      console.log('Microphone access granted, stream:', stream)
      streamRef.current = stream

      // Create MediaRecorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus') 
          ? 'audio/webm;codecs=opus'
          : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : 'audio/mp4',
      })
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = async () => {
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop())

        // Create blob from recorded chunks
        const audioBlob = new Blob(audioChunksRef.current, { type: mediaRecorder.mimeType })
        
        // Transcribe using Whisper
        setIsTranscribing(true)
        setTranscript("Transcribing your speech...")
        
        try {
          const result = await transcribeAudio({ audioBlob })
          setTranscript(result.text)
        } catch (error) {
          console.error('Transcription error:', error)
          const errorMessage = error instanceof Error ? error.message : 'Failed to transcribe audio'
          setTranscript("")
          toast({
            title: "Transcription failed",
            description: errorMessage,
            variant: "destructive",
          })
        } finally {
          setIsTranscribing(false)
        }
      }

      // Start recording
      mediaRecorder.start()
      setIsRecording(true)
      setTranscript("")
      audioChunksRef.current = []
    } catch (error: any) {
      console.error('Error starting recording:', error)
      
      // Provide specific error messages based on error type
      let errorTitle = "Microphone access denied"
      let errorDescription = "Please allow microphone access to use voice input."
      
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        errorTitle = "Microphone permission denied"
        errorDescription = "Please click the microphone icon in your browser's address bar and allow microphone access, then try again."
      } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        errorTitle = "No microphone found"
        errorDescription = "No microphone device was found. Please connect a microphone and try again."
      } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
        errorTitle = "Microphone in use"
        errorDescription = "The microphone is being used by another application. Please close other applications using the microphone and try again."
      } else if (error.name === 'OverconstrainedError' || error.name === 'ConstraintNotSatisfiedError') {
        errorTitle = "Microphone constraints not met"
        errorDescription = "Your microphone doesn't support the required settings. Please try a different microphone."
      } else if (error.message) {
        errorDescription = error.message
      }
      
      toast({
        title: errorTitle,
        description: errorDescription,
        variant: "destructive",
      })
    }
  }

  const handleStopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
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
            {isRecording 
              ? "Speak clearly into your microphone" 
              : "Click the microphone button below to start recording. Your browser will ask for microphone permission."}
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
          
          {isTranscribing && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Processing audio...</span>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleUseTranscript} disabled={!transcript || isRecording || isTranscribing}>
            Use Transcript
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
