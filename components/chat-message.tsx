"use client"

import type { ChatMessage } from "@/types/chat"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { FileText, ImageIcon } from "lucide-react"
import { cn } from "@/lib/utils"

interface ChatMessageProps {
  message: ChatMessage
}

export function ChatMessageComponent({ message }: ChatMessageProps) {
  const isUser = message.role === "user"

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
          <div className="rounded-lg border border-border bg-muted/30 p-2 flex items-center gap-2 text-xs">
            {message.contextAttachment.type === "image" ? (
              <ImageIcon className="h-4 w-4 text-muted-foreground" />
            ) : (
              <FileText className="h-4 w-4 text-muted-foreground" />
            )}
            <span className="text-muted-foreground">{message.contextAttachment.name || "Attachment"}</span>
          </div>
        )}

        <div
          className={cn(
            "rounded-2xl px-4 py-3 text-sm leading-relaxed",
            isUser ? "bg-primary text-primary-foreground" : "bg-muted text-foreground",
          )}
        >
          {message.content}
          
          {/* Display image if available */}
          {message.imageUrl && (
            <div className="mt-3 rounded-lg overflow-hidden">
              <img 
                src={message.imageUrl} 
                alt="Generated design" 
                className="max-w-full h-auto rounded-lg"
              />
            </div>
          )}
          
          {message.imageData && (
            <div className="mt-3 rounded-lg overflow-hidden">
              <img 
                src={message.imageData} 
                alt="Generated design" 
                className="max-w-full h-auto rounded-lg"
              />
            </div>
          )}
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
        <Avatar className="h-8 w-8 shrink-0">
          <AvatarFallback className="bg-secondary text-secondary-foreground text-xs">U</AvatarFallback>
        </Avatar>
      )}
    </div>
  )
}
