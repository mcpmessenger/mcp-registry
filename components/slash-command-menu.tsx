"use client"

import { useState, useEffect, useRef } from "react"
import type { AgentOption } from "@/types/chat"
import { Sparkles, Bot, Search } from "lucide-react"
import { cn } from "@/lib/utils"

interface SlashCommandMenuProps {
  agents: AgentOption[]
  open: boolean
  onSelect: (agentId: string) => void
  onClose: () => void
  searchQuery?: string
  selectedIndex?: number
  onSelectedIndexChange?: (index: number) => void
}

export function SlashCommandMenu({
  agents,
  open,
  onSelect,
  onClose,
  searchQuery = "",
  selectedIndex: controlledSelectedIndex,
  onSelectedIndexChange,
}: SlashCommandMenuProps) {
  const [filteredAgents, setFilteredAgents] = useState<AgentOption[]>(agents)
  const [internalSelectedIndex, setInternalSelectedIndex] = useState(0)
  const commandRef = useRef<HTMLDivElement>(null)

  // Use controlled or internal state
  const selectedIndex =
    controlledSelectedIndex !== undefined
      ? controlledSelectedIndex
      : internalSelectedIndex

  const setSelectedIndex = (index: number) => {
    if (onSelectedIndexChange) {
      onSelectedIndexChange(index)
    } else {
      setInternalSelectedIndex(index)
    }
  }

  // Filter agents based on search query
  useEffect(() => {
    if (!searchQuery) {
      setFilteredAgents(agents)
      setSelectedIndex(0)
      return
    }

    const query = searchQuery.toLowerCase().replace(/^\//, "")
    const filtered = agents.filter((agent) =>
      agent.name.toLowerCase().includes(query)
    )
    setFilteredAgents(filtered)
    setSelectedIndex(0)
  }, [searchQuery, agents])

  const handleSelect = (agentId: string) => {
    onSelect(agentId)
    onClose()
  }

  // Scroll selected item into view when it changes
  useEffect(() => {
    if (!open || !commandRef.current || filteredAgents.length === 0) return
    
    const selectedItem = commandRef.current.querySelector(
      `[data-index="${selectedIndex}"]`
    ) as HTMLElement | null
    
    if (selectedItem) {
      selectedItem.scrollIntoView({ block: "nearest", behavior: "smooth" })
    }
  }, [selectedIndex, open, filteredAgents.length])

  if (!open) return null

  return (
    <div
      ref={commandRef}
      className="z-50 min-w-[280px] max-w-[320px] overflow-hidden rounded-lg border bg-popover shadow-lg"
    >
      <div className="flex items-center border-b px-3 py-2 bg-muted/50">
        <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
        <span className="text-sm text-muted-foreground">
          {searchQuery ? `Searching "${searchQuery.replace(/^\//, "")}"` : "Select MCP server"}
        </span>
      </div>
      <div className="max-h-[300px] overflow-y-auto p-1">
        {filteredAgents.length === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground">
            No servers found.
          </div>
        ) : (
          <div className="space-y-0.5">
            {filteredAgents.map((agent, index) => (
              <div
                key={agent.id}
                onClick={() => handleSelect(agent.id)}
                data-index={index}
                className={cn(
                  "relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors",
                  "hover:bg-accent hover:text-accent-foreground",
                  index === selectedIndex && "bg-accent text-accent-foreground"
                )}
              >
                <div className="flex items-center gap-2 flex-1">
                  {agent.type === "router" ? (
                    <Sparkles className="h-4 w-4 text-secondary" />
                  ) : (
                    <Bot className="h-4 w-4 text-primary" />
                  )}
                  <span>{agent.name}</span>
                </div>
                {index === selectedIndex && (
                  <span className="text-xs text-muted-foreground ml-auto">
                    Enter
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

