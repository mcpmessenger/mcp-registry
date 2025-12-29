"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Send, Mic, Paperclip, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { SlashCommandMenu } from "@/components/slash-command-menu"
import type { AgentOption } from "@/types/chat"

interface ChatInputProps {
  onSendMessage: (message: string, attachment?: { type: "image" | "document"; name?: string; preview?: string }) => void
  onVoiceInput: () => void
  onFileUpload: () => void
  onAgentSelect?: (agentId: string) => void
  agentOptions?: AgentOption[]
  isLoading?: boolean
}

export function ChatInput({
  onSendMessage,
  onVoiceInput,
  onFileUpload,
  onAgentSelect,
  agentOptions = [],
  isLoading = false,
}: ChatInputProps) {
  const [message, setMessage] = useState("")
  const [showSlashMenu, setShowSlashMenu] = useState(false)
  const [slashQuery, setSlashQuery] = useState("")
  const [selectedMenuIndex, setSelectedMenuIndex] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const menuContainerRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Detect slash command
  useEffect(() => {
    const text = message
    const cursorPos = textareaRef.current?.selectionStart ?? text.length
    const textBeforeCursor = text.slice(0, cursorPos)
    const lastSlashIndex = textBeforeCursor.lastIndexOf("/")

    // Check if we're in a slash command (not inside a word)
    if (lastSlashIndex >= 0) {
      const textAfterSlash = textBeforeCursor.slice(lastSlashIndex + 1)
      const isInWord = lastSlashIndex > 0 && /\w/.test(textBeforeCursor[lastSlashIndex - 1])
      const hasSpaceAfterSlash = textAfterSlash.includes(" ")

      if (!isInWord && !hasSpaceAfterSlash) {
        setShowSlashMenu(true)
        const newQuery = textAfterSlash
        setSlashQuery(newQuery)
        // Reset selection when query changes - use a small delay to ensure state updates
        setSelectedMenuIndex(0)
        return
      }
    }

    setShowSlashMenu(false)
    setSlashQuery("")
    setSelectedMenuIndex(0)
  }, [message])

  const handleSubmit = () => {
    // Don't submit if slash menu is open
    if (showSlashMenu) return

    if (message.trim() && !isLoading) {
      onSendMessage(message)
      setMessage("")
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto"
      }
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // If slash menu is open, handle navigation
    if (showSlashMenu && agentOptions.length > 0) {
      // Get filtered agents based on current query
      const query = slashQuery.toLowerCase()
      const filtered = query
        ? agentOptions.filter((agent) =>
            agent.name.toLowerCase().includes(query)
          )
        : agentOptions

      if (e.key === "ArrowDown") {
        e.preventDefault()
        setSelectedMenuIndex((prev) =>
          prev < filtered.length - 1 ? prev + 1 : prev
        )
        return
      } else if (e.key === "ArrowUp") {
        e.preventDefault()
        setSelectedMenuIndex((prev) => (prev > 0 ? prev - 1 : 0))
        return
      } else if (e.key === "Enter") {
        e.preventDefault()
        // Select agent at current index
        if (filtered[selectedMenuIndex]) {
          handleSlashSelect(filtered[selectedMenuIndex].id)
        }
        return
      } else if (e.key === "Escape") {
        e.preventDefault()
        setShowSlashMenu(false)
        // Remove the "/" from message
        const text = message
        const cursorPos = textareaRef.current?.selectionStart ?? text.length
        const textBeforeCursor = text.slice(0, cursorPos)
        const lastSlashIndex = textBeforeCursor.lastIndexOf("/")
        if (lastSlashIndex >= 0) {
          const newMessage =
            text.slice(0, lastSlashIndex) + text.slice(cursorPos)
          setMessage(newMessage)
          setTimeout(() => {
            textareaRef.current?.setSelectionRange(
              lastSlashIndex,
              lastSlashIndex
            )
            textareaRef.current?.focus()
          }, 0)
        }
        return
      }
    }

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

  const handleSlashSelect = (agentId: string) => {
    // Remove the slash command from message
    const text = message
    const cursorPos = textareaRef.current?.selectionStart ?? text.length
    const textBeforeCursor = text.slice(0, cursorPos)
    const lastSlashIndex = textBeforeCursor.lastIndexOf("/")

    if (lastSlashIndex >= 0) {
      const newMessage =
        text.slice(0, lastSlashIndex) + text.slice(cursorPos)
      setMessage(newMessage)
    }

    setShowSlashMenu(false)
    setSlashQuery("")

    // Call the agent select callback
    if (onAgentSelect) {
      onAgentSelect(agentId)
    }

    // Focus back on textarea
    setTimeout(() => {
      textareaRef.current?.focus()
    }, 0)
  }

  // Handle drag and drop for images
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    const files = Array.from(e.dataTransfer.files)
    const imageFiles = files.filter(file => file.type.startsWith('image/'))

    if (imageFiles.length > 0) {
      // Process the first image file
      const file = imageFiles[0]
      const reader = new FileReader()
      
      reader.onload = (event) => {
        const preview = event.target?.result as string
        onSendMessage("Can you analyze this image?", {
          type: "image" as const,
          name: file.name,
          preview: preview,
        })
      }
      
      reader.readAsDataURL(file)
    }
  }

  // Calculate menu position
  const getMenuPosition = () => {
    if (!textareaRef.current) return {}

    const rect = textareaRef.current.getBoundingClientRect()
    
    // Position above the textarea
    return {
      position: "fixed" as const,
      bottom: `${window.innerHeight - rect.top + 8}px`,
      left: `${rect.left}px`,
      maxWidth: "320px",
    }
  }

  return (
    <div 
      ref={containerRef}
      className="relative sticky bottom-0 z-40 w-full p-4 sm:p-6"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Backlight effect - ATM style glow */}
      <div className="absolute inset-0 bg-gradient-to-t from-blue-500/40 via-cyan-500/30 to-blue-400/20 opacity-70 blur-3xl -z-10" />
      <div className="absolute inset-0 bg-gradient-to-t from-cyan-500/20 via-blue-500/15 to-transparent opacity-50 blur-2xl -z-10" />
      
      {/* Drag overlay */}
      {isDragging && (
        <div className="absolute inset-0 z-50 rounded-2xl bg-blue-500/20 border-2 border-dashed border-blue-400/50 backdrop-blur-sm flex items-center justify-center">
          <p className="text-sm font-medium text-foreground">Drop image here to analyze</p>
        </div>
      )}
      
      {/* Glassmorphic container */}
      <div className={`relative rounded-2xl border border-white/20 backdrop-blur-xl bg-gradient-to-br from-white/15 to-white/5 p-4 shadow-2xl hover:shadow-[0_0_40px_rgba(59,130,246,0.3)] transition-shadow duration-500 ${isDragging ? 'border-blue-400/50' : ''}`}>
        <div className="flex items-end gap-2 max-w-full w-full relative">
        {/* Left side buttons - microphone first, shifted right to avoid logo */}
        <div className="flex gap-2 shrink-0 relative z-50 ml-4 sm:ml-12">
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={onVoiceInput}
            className={cn("shrink-0 bg-white/10 border-white/20 hover:bg-white/20 hover:border-white/30 backdrop-blur-sm")}
            title="Voice input"
          >
            <Mic className={cn("h-4 w-4")} />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={onFileUpload}
            className="shrink-0 bg-white/10 border-white/20 hover:bg-white/20 hover:border-white/30 backdrop-blur-sm"
            title="Upload file"
          >
            <Paperclip className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1 relative">
        <Textarea
          ref={textareaRef}
          value={message}
          onChange={handleTextareaChange}
          onKeyDown={handleKeyDown}
            placeholder="Try / commands"
          className="min-h-[44px] max-h-[200px] resize-none bg-white/10 border-white/20 backdrop-blur-sm focus:bg-white/15 focus:border-white/30 transition-all"
          disabled={isLoading}
        />

          {/* Slash command menu */}
          {showSlashMenu && agentOptions.length > 0 && (
            <div ref={menuContainerRef} style={getMenuPosition()}>
              <SlashCommandMenu
                agents={agentOptions}
                open={showSlashMenu}
                onSelect={handleSlashSelect}
                onClose={() => setShowSlashMenu(false)}
                searchQuery={slashQuery}
                selectedIndex={selectedMenuIndex}
                onSelectedIndexChange={setSelectedMenuIndex}
              />
            </div>
          )}
        </div>

        <Button 
          onClick={handleSubmit} 
          disabled={!message.trim() || isLoading} 
          className="shrink-0 h-[44px] bg-primary hover:bg-primary/90 shadow-lg hover:shadow-xl transition-all"
        >
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
        </div>
      </div>
    </div>
  )
}
