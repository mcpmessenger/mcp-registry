"use client"

import type { AgentOption } from "@/types/chat"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sparkles, Bot } from "lucide-react"

interface AgentSelectorProps {
  agents: AgentOption[]
  selectedAgentId: string
  onAgentChange: (agentId: string) => void
}

export function AgentSelector({ agents, selectedAgentId, onAgentChange }: AgentSelectorProps) {
  return (
    <div className="relative">
      {/* Subtle backglow */}
      <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 via-cyan-500/5 to-green-500/10 blur-2xl opacity-50" />
      
      <div className="relative flex flex-col gap-2 px-4 py-3 border-b border-white/20 backdrop-blur-md bg-gradient-to-br from-white/10 to-white/5 sm:flex-row sm:items-center sm:gap-3">
        <span className="text-sm text-foreground/80 font-medium">Agent:</span>
        <Select value={selectedAgentId} onValueChange={onAgentChange} className="w-full sm:w-auto">
          <SelectTrigger className="w-full min-w-0 sm:w-[240px] h-9 bg-white/10 border-white/20 backdrop-blur-sm hover:bg-white/15">
            <SelectValue />
          </SelectTrigger>
        <SelectContent>
          {agents.map((agent) => (
            <SelectItem key={agent.id} value={agent.id}>
              <div className="flex items-center gap-2">
                {agent.type === "router" ? (
                  <Sparkles className="h-3.5 w-3.5 text-secondary" />
                ) : (
                  <Bot className="h-3.5 w-3.5 text-primary" />
                )}
                {agent.name}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      </div>
    </div>
  )
}
