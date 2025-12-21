"use client"

import { useState } from "react"
import type { ChatMessage } from "@/types/chat"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { AudioPlayer } from "@/components/audio-player"
import { FileText, ImageIcon, Code2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface ChatMessageProps {
  message: ChatMessage
}

/**
 * Extract SVG from message content
 */
function extractSVG(content: string): { svg: string | null; remainingText: string } {
  // Try to extract SVG from markdown code blocks
  const codeBlockMatch = content.match(/```(?:svg|xml)?\s*([\s\S]*?)```/i)
  if (codeBlockMatch) {
    const svgContent = codeBlockMatch[1].trim()
    if (svgContent.includes('<svg')) {
      return {
        svg: svgContent,
        remainingText: content.replace(/```(?:svg|xml)?\s*[\s\S]*?```/i, '').trim(),
      }
    }
  }

  // Try to extract SVG directly from content
  const svgMatch = content.match(/<svg[\s\S]*?<\/svg>/i)
  if (svgMatch) {
    return {
      svg: svgMatch[0],
      remainingText: content.replace(/<svg[\s\S]*?<\/svg>/i, '').trim(),
    }
  }

  return { svg: null, remainingText: content }
}

/**
 * Extract base64 images from message content
 */
function extractImages(content: string): Array<{ dataUrl: string; mimeType: string }> {
  const images: Array<{ dataUrl: string; mimeType: string }> = []
  
  // Look for data URLs (data:image/...;base64,...)
  const dataUrlMatch = content.match(/data:image\/([^;]+);base64,([^\s"']+)/gi)
  if (dataUrlMatch) {
    dataUrlMatch.forEach(url => {
      const match = url.match(/data:image\/([^;]+);base64,(.+)/i)
      if (match) {
        images.push({
          dataUrl: url,
          mimeType: `image/${match[1]}`,
        })
      }
    })
  }
  
  return images
}

/**
 * Render message content with SVG and image support
 */
function MessageContent({ content, isUser }: { content: string; isUser: boolean }) {
  const { svg, remainingText } = extractSVG(content)
  const images = extractImages(content)
  const [showCode, setShowCode] = useState(false)

  // If we have images, render them
  if (images.length > 0) {
    return (
      <div className="space-y-3">
        {images.map((img, idx) => (
          <div key={idx} className="flex flex-col items-center gap-2 p-2 bg-background rounded-lg border border-border">
            <img
              src={img.dataUrl}
              alt={`Screenshot ${idx + 1}`}
              className="max-w-full max-h-96 object-contain rounded"
            />
            <p className="text-xs text-muted-foreground">Screenshot</p>
          </div>
        ))}
        {remainingText && (
          <div className="whitespace-pre-wrap break-words">
            {remainingText}
          </div>
        )}
      </div>
    )
  }

  if (!svg) {
    // No SVG found, render as plain text
    return (
      <div className="whitespace-pre-wrap break-words">
        {content}
      </div>
    )
  }

  // SVG found, render both visual and code
  return (
    <div className="space-y-3">
      {/* Render SVG visually */}
      <div className="flex flex-col items-center gap-2 p-4 bg-background rounded-lg border border-border">
        <div 
          className="max-w-full max-h-96 overflow-auto flex items-center justify-center bg-white/5 rounded"
          style={{ minHeight: '200px' }}
          dangerouslySetInnerHTML={{ __html: svg }}
        />
        <p className="text-xs text-muted-foreground">Generated SVG Preview</p>
      </div>

      {/* Show remaining text if any */}
      {remainingText && (
        <div className="whitespace-pre-wrap break-words">
          {remainingText}
        </div>
      )}

      {/* Toggle code view */}
      <button
        onClick={() => setShowCode(!showCode)}
        className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <Code2 className="h-3 w-3" />
        {showCode ? 'Hide' : 'Show'} SVG Code
      </button>

      {/* Show code in collapsible section */}
      {showCode && (
        <div className="relative">
          <pre className="p-3 bg-muted rounded-lg overflow-x-auto text-xs">
            <code>{svg}</code>
          </pre>
        </div>
      )}
    </div>
  )
}

export function ChatMessageComponent({ message }: ChatMessageProps) {
  const isUser = message.role === "user"
  
  // Render attachment preview if present
  const renderAttachment = () => {
    if (!message.contextAttachment) return null

    const { type, url, preview, name } = message.contextAttachment

    if (type === "image" || type === "glazyr") {
      const imageUrl = url || preview
      if (!imageUrl) return null

      return (
        <div className="mt-2 rounded-lg border border-border overflow-hidden">
          <img
            src={imageUrl}
            alt={name || "Attachment"}
            className="max-w-full max-h-96 object-contain"
          />
          {type === "glazyr" && (
            <div className="px-3 py-2 bg-muted/50 text-xs text-muted-foreground">
              📸 Screen capture
            </div>
          )}
        </div>
      )
    }

    if (type === "document") {
      return (
        <div className="mt-2 flex items-center gap-2 p-3 bg-muted/50 rounded-lg border border-border">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm">{name || "Document"}</span>
        </div>
      )
    }

    return null
  }

  return (
    <div className={cn("flex gap-3 py-4", isUser ? "justify-end" : "justify-start")}>
      {!isUser && (
        <Avatar className="h-8 w-8 shrink-0">
          <AvatarFallback className="bg-primary text-primary-foreground text-xs">AI</AvatarFallback>
        </Avatar>
      )}

      <div className={cn("flex flex-col gap-2 max-w-[70%]", isUser && "items-end")}>
        {message.agentName && (
          <div className="flex items-center gap-2 px-3 py-1 rounded-md bg-muted/50 text-xs text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-secondary animate-pulse" />
            Routed to {message.agentName}
          </div>
        )}

        {message.contextAttachment && (
          <div className="rounded-lg border border-border bg-muted/30 overflow-hidden">
            {(message.contextAttachment.type === "image" || message.contextAttachment.type === "glazyr") && message.contextAttachment.url ? (
              <div className="relative">
                <img
                  src={message.contextAttachment.url}
                  alt={message.contextAttachment.name || "Attachment"}
                  className="max-w-full max-h-64 object-contain w-full"
                />
                {message.contextAttachment.type === "glazyr" && (
                  <div className="absolute top-2 right-2 px-2 py-1 bg-black/50 text-white text-xs rounded">
                    📸 Screen Capture
                  </div>
                )}
              </div>
            ) : (
              <div className="p-2 flex items-center gap-2 text-xs">
                {message.contextAttachment.type === "image" || message.contextAttachment.type === "glazyr" ? (
                  <ImageIcon className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <FileText className="h-4 w-4 text-muted-foreground" />
                )}
                <span className="text-muted-foreground">{message.contextAttachment.name || "Attachment"}</span>
              </div>
            )}
          </div>
        )}

        <div
          className={cn(
            "rounded-2xl px-4 py-3 text-sm leading-relaxed w-full",
            isUser ? "bg-primary text-primary-foreground" : "bg-muted text-foreground",
          )}
        >
          <MessageContent content={message.content} isUser={isUser} />
        </div>

        <div className="flex items-center gap-2 px-1">
          <span className="text-xs text-muted-foreground">
            {new Intl.DateTimeFormat("en-US", {
              hour: "numeric",
              minute: "2-digit",
            }).format(message.timestamp)}
          </span>
        </div>

        {message.audioUrl && !isUser && (
          <div className="w-full max-w-sm">
            <AudioPlayer audioUrl={message.audioUrl} />
          </div>
        )}
      </div>

      {isUser && (
        <Avatar className="h-8 w-8 shrink-0">
          <AvatarFallback className="bg-secondary text-secondary-foreground text-xs">U</AvatarFallback>
        </Avatar>
      )}
    </div>
  )
}
