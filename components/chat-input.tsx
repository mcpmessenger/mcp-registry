"use client"

import type React from "react"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Send, Mic, Paperclip, Monitor, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface ChatInputProps {
  onSendMessage: (message: string) => void
  onVoiceInput: () => void
  onFileUpload: () => void
  onGlazyrCapture: () => void
  isLoading?: boolean
}

export function ChatInput({
  onSendMessage,
  onVoiceInput,
  onFileUpload,
  onGlazyrCapture,
  isLoading = false,
}: ChatInputProps) {
  const [message, setMessage] = useState("")
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleSubmit = () => {
    if (message.trim() && !isLoading) {
      onSendMessage(message)
      setMessage("")
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto"
      }
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value)
    // Auto-resize textarea
    e.target.style.height = "auto"
    e.target.style.height = `${Math.min(e.target.scrollHeight, 200)}px`
  }

  return (
    <div className="border-t border-border bg-card/50 p-4 sticky bottom-0 z-40 backdrop-blur-sm w-full">
      <div className="flex items-end gap-2 max-w-full w-full">
        {/* Left side buttons - microphone first, shifted right to avoid logo */}
        <div className="flex gap-2 shrink-0 relative z-50 ml-12">
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={onVoiceInput}
            className={cn("shrink-0 bg-transparent relative z-50 min-w-[44px] h-[44px]")}
            title="Voice input"
          >
            <Mic className={cn("h-4 w-4 shrink-0")} />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={onFileUpload}
            className="shrink-0 bg-transparent min-w-[44px] h-[44px]"
            title="Upload file"
          >
            <Paperclip className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={onGlazyrCapture}
            className="shrink-0 bg-transparent min-w-[44px] h-[44px]"
            title="Capture screen (Glazyr)"
          >
            <Monitor className="h-4 w-4" />
          </Button>
        </div>

        {/* Text input - takes remaining space */}
        <Textarea
          ref={textareaRef}
          value={message}
          onChange={handleTextareaChange}
          onKeyDown={handleKeyDown}
          placeholder="Type your message... (Shift+Enter for new line)"
          className="min-h-[44px] max-h-[200px] resize-none flex-1"
          disabled={isLoading}
        />

        {/* Send button */}
        <Button onClick={handleSubmit} disabled={!message.trim() || isLoading} className="shrink-0 h-[44px] min-w-[44px]">
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  )
}
