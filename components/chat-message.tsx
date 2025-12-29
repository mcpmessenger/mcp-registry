"use client"

import type { ChatMessage } from "@/types/chat"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { FileText, ImageIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { useState, useEffect } from "react"

// Helper function to convert text with URLs to JSX with clickable links
function renderContentWithLinks(content: string) {
  // URL regex pattern - matches http(s):// URLs and www. URLs
  const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+|\b[\w-]+\.[a-z]{2,}(?:\/[^\s]*)?)/gi
  
  const parts: (string | JSX.Element)[] = []
  let lastIndex = 0
  let match
  
  while ((match = urlRegex.exec(content)) !== null) {
    // Add text before the URL
    if (match.index > lastIndex) {
      parts.push(content.slice(lastIndex, match.index))
    }
    
    // Process the matched URL
    let url = match[0]
    // Add protocol if missing
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url
    }
    
    // Add the clickable link
    parts.push(
      <a
        key={match.index}
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary hover:underline underline-offset-2"
      >
        {match[0]}
      </a>
    )
    
    lastIndex = match.index + match[0].length
  }
  
  // Add remaining text
  if (lastIndex < content.length) {
    parts.push(content.slice(lastIndex))
  }
  
  return parts.length > 0 ? parts : content
}

interface ChatMessageProps {
  message: ChatMessage
}

export function ChatMessageComponent({ message }: ChatMessageProps) {
  const isUser = message.role === "user"
  const [imageSrc, setImageSrc] = useState<string | null>(null)

  // Convert base64 image data to blob URL to avoid 414 errors
  useEffect(() => {
    if (message.imageData) {
      // Check if it's already a data URI
      if (message.imageData.startsWith('data:')) {
        // If it's a data URI, convert to blob URL
        try {
          const base64Data = message.imageData.split(',')[1] || message.imageData
          const mimeMatch = message.imageData.match(/data:([^;]+);base64/)
          const mimeType = mimeMatch ? mimeMatch[1] : 'image/png'
          
          // Convert base64 to binary
          const binaryString = atob(base64Data)
          const bytes = new Uint8Array(binaryString.length)
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i)
          }
          
          // Create blob and URL
          const blob = new Blob([bytes], { type: mimeType })
          const blobUrl = URL.createObjectURL(blob)
          setImageSrc(blobUrl)
          
          // Cleanup on unmount
          return () => {
            URL.revokeObjectURL(blobUrl)
          }
        } catch (error) {
          console.error('Error converting base64 to blob:', error)
          // Fallback to direct data URI if conversion fails
          setImageSrc(message.imageData)
        }
      } else {
        // Assume it's raw base64, add data URI prefix
        setImageSrc(`data:image/png;base64,${message.imageData}`)
      }
    } else if (message.imageUrl) {
      setImageSrc(message.imageUrl)
    }
  }, [message.imageData, message.imageUrl])

  return (
    <div className={cn("flex gap-3 py-4", isUser ? "justify-end" : "justify-start")}>
      {!isUser && (
        <Avatar className="h-8 w-8 shrink-0 ring-2 ring-white/20 backdrop-blur-sm">
          <AvatarFallback className="bg-gradient-to-br from-green-500/20 to-emerald-500/10 text-foreground text-xs border border-white/20">AI</AvatarFallback>
        </Avatar>
      )}

      <div className={cn("flex flex-col gap-2 max-w-[85%] sm:max-w-[70%] w-full", isUser && "items-end")}>
        {message.agentName && (
          <div className="flex items-center gap-2 px-3 py-1 rounded-lg backdrop-blur-md bg-white/10 border border-white/20 text-xs text-foreground/80">
            <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
            Routed to {message.agentName}
          </div>
        )}

        {message.contextAttachment && (
          <div className="rounded-lg border border-white/20 backdrop-blur-md bg-white/10 p-2 flex items-center gap-2 text-xs">
            {message.contextAttachment.type === "image" ? (
              <ImageIcon className="h-4 w-4 text-foreground/70" />
            ) : (
              <FileText className="h-4 w-4 text-foreground/70" />
            )}
            <span className="text-foreground/70">{message.contextAttachment.name || "Attachment"}</span>
          </div>
        )}

        <div className="relative group">
          {/* Backglow effect - different colors for user vs assistant */}
          {isUser ? (
            <div className="absolute -inset-0.5 bg-gradient-to-br from-blue-500/40 via-cyan-500/30 to-blue-400/20 rounded-2xl blur-lg opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          ) : (
            <div className="absolute -inset-0.5 bg-gradient-to-br from-green-500/30 via-emerald-500/20 to-green-400/15 rounded-2xl blur-lg opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          )}
          
          <div
            className={cn(
              "relative rounded-2xl px-4 py-3 text-sm leading-relaxed backdrop-blur-md border border-white/20",
              isUser 
                ? "bg-gradient-to-br from-blue-500/20 to-cyan-500/10 text-foreground shadow-lg" 
                : "bg-gradient-to-br from-white/15 to-white/5 text-foreground shadow-lg",
            )}
          >
          <div className="whitespace-pre-wrap break-words">
            {renderContentWithLinks(message.content)}
          </div>
          
          {/* Display image if available */}
          {imageSrc && (
            <div className="mt-3 rounded-lg overflow-hidden">
              <img 
                src={imageSrc} 
                alt="Generated design" 
                className="max-w-full h-auto rounded-lg"
                onError={(e) => {
                  console.error('Image failed to load:', e)
                  setImageSrc(null)
                }}
              />
            </div>
          )}
          </div>
        </div>

        <div className="flex items-center gap-2 px-1">
          <span className="text-xs text-muted-foreground">
            {new Intl.DateTimeFormat("en-US", {
              hour: "numeric",
              minute: "2-digit",
            }).format(message.timestamp)}
          </span>
        </div>
      </div>

      {isUser && (
        <Avatar className="h-8 w-8 shrink-0 ring-2 ring-white/20 backdrop-blur-sm">
          <AvatarFallback className="bg-gradient-to-br from-blue-500/20 to-cyan-500/10 text-foreground text-xs border border-white/20">U</AvatarFallback>
        </Avatar>
      )}
    </div>
  )
}
