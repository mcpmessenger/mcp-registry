"use client"

import { useState, useEffect, useRef } from "react"
import { searchServers } from "@/lib/api"
import { transformServersToAgents } from "@/lib/server-utils"
import type { MCPAgent } from "@/types/agent"
import type { MCPServer } from "@/lib/api"
import { AgentCard } from "@/components/agent-card"
import { AgentDetailsDialog } from "@/components/agent-details-dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Search, Loader2, Sparkles, Hash, Mic } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
// Simple debounce hook
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => clearTimeout(handler)
  }, [value, delay])

  return debouncedValue
}

const DEBOUNCE_DELAY = 250

export default function SearchPage() {
  const [query, setQuery] = useState("")
  const [debouncedQuery, setDebouncedQuery] = useState("")
  const [agents, setAgents] = useState<MCPAgent[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchType, setSearchType] = useState<'semantic' | 'keyword'>('semantic')
  const [selectedAgent, setSelectedAgent] = useState<MCPAgent | null>(null)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [speechSupported, setSpeechSupported] = useState(false)
  const { toast } = useToast()
  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const setToastMessage = (message: string) => {
    toast({
      title: "Voice search",
      description: message,
    })
  }

  // Debounce the query
  const debounced = useDebounce(query, DEBOUNCE_DELAY)

  useEffect(() => {
    if (typeof window === "undefined") return
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) return

    setSpeechSupported(true)
    const recognition = new SpeechRecognition()
    recognition.continuous = false
    recognition.interimResults = false
    recognition.lang = "en-US"
    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0].transcript)
        .join(" ")
      if (transcript.trim()) {
        setQuery((prev) => `${prev} ${transcript}`.trim())
      }
    }
    recognition.onerror = () => {
      setToastMessage("Speech recognition failed. Try again.")
      setIsListening(false)
    }
    recognition.onend = () => {
      setIsListening(false)
    }
    recognitionRef.current = recognition

    return () => {
      recognition.stop()
    }
  }, [])

  const toggleVoiceSearch = () => {
    if (!recognitionRef.current) {
      setToastMessage("Speech recognition is not supported in this browser.")
      return
    }

    if (isListening) {
      recognitionRef.current.stop()
      setIsListening(false)
    } else {
      recognitionRef.current.start()
      setIsListening(true)
      setToastMessage("Listening...")
    }
  }

  useEffect(() => {
    setDebouncedQuery(debounced)
  }, [debounced])

  // Perform search when debounced query changes
  useEffect(() => {
    if (!debouncedQuery.trim()) {
      setAgents([])
      return
    }

    let isMounted = true

    async function performSearch() {
      try {
        setIsLoading(true)
        setError(null)
        
        const result = await searchServers({
          query: debouncedQuery,
          limit: 20,
          minConfidence: 0.2,
          useVectorSearch: true,
        })

        if (!isMounted) return

        setSearchType(result.searchType)
        
        // Transform servers to agents
        const transformedAgents = transformServersToAgents(result.results)
        setAgents(transformedAgents)
      } catch (err) {
        if (!isMounted) return
        
        const errorMessage = err instanceof Error ? err.message : 'Failed to search servers'
        console.error('Error searching servers:', err)
        setError(errorMessage)
        toast({
          title: "Search error",
          description: errorMessage,
          variant: "destructive",
        })
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    performSearch()

    return () => {
      isMounted = false
    }
  }, [debouncedQuery, toast])

  const handleViewDetails = (agent: MCPAgent) => {
    setSelectedAgent(agent)
    setDetailsOpen(true)
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setDebouncedQuery(query)
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="space-y-6">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-tight">
            MCP Search
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground/80">
            Search MCP servers using semantic search powered by vector embeddings
          </p>
        </div>

        {/* Search Form */}
        <form onSubmit={handleSearch} className="space-y-4">
          <div className="relative group">
            <div className="absolute -inset-3 rounded-[30px] bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.45),_transparent_60%)] blur-2xl opacity-70 transition-opacity duration-300 group-hover:opacity-100" aria-hidden />
            <div className="absolute inset-0 rounded-[30px] border border-white/10 bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-3xl shadow-[0_25px_60px_rgba(15,23,42,0.55)] transition-all duration-300 group-hover:shadow-[0_45px_120px_rgba(59,130,246,0.75)]" aria-hidden />
            <div className="relative rounded-[30px] border border-white/5 bg-gradient-to-br from-white/10 to-transparent p-4 shadow-[0_20px_50px_rgba(2,6,23,0.5)] transition-shadow duration-500 group-hover:shadow-[0_35px_90px_rgba(59,130,246,0.4)]">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={toggleVoiceSearch}
                  disabled={!speechSupported}
                  className="rounded-full border border-white/20 bg-white/10 p-2 text-white/80 shadow-sm hover:border-white/40 hover:bg-white/20 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Mic className="h-4 w-4" />
                </button>
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="Search MCP servers or tools..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="pl-10 h-12 text-base bg-white/5 border-white/20 focus:border-white/40 focus:bg-white/10 transition-all"
                  />
                </div>
                <Button type="submit" size="lg" disabled={isLoading || !query.trim()}>
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Searching...
                    </>
                  ) : (
                    <>
                      <Search className="h-4 w-4 mr-2" />
                      Search
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>

          {query.trim() && !isLoading && agents.length > 0 && (
            <div className="rounded-lg border border-border bg-popover shadow-md mt-2">
              <ul role="listbox" className="divide-y divide-border">
                {agents.slice(0, 5).map((agent) => (
                  <li key={agent.id}>
                    <button
                      type="button"
                      onClick={() => handleViewDetails(agent)}
                      className="w-full px-4 py-3 text-left hover:bg-accent/60 focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold">{agent.name}</span>
                        {agent._searchMetadata?.similarityScore != null && (
                          <span className="text-xs text-muted-foreground">
                            {(agent._searchMetadata.similarityScore * 100).toFixed(0)}%
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {agent.description}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Search Type Badge */}
          {debouncedQuery && (
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="gap-1.5">
                {searchType === 'semantic' ? (
                  <>
                    <Sparkles className="h-3 w-3" />
                    Semantic Search
                  </>
                ) : (
                  <>
                    <Hash className="h-3 w-3" />
                    Keyword Search
                  </>
                )}
              </Badge>
              {agents.length > 0 && (
                <span className="text-sm text-muted-foreground">
                  Found {agents.length} result{agents.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>
          )}
        </form>

        {/* Error State */}
        {error && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        {/* Empty State */}
        {!debouncedQuery && !isLoading && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Search className="h-12 w-12 text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">Start searching</h2>
            <p className="text-muted-foreground max-w-md">
              Enter a search query to find MCP servers by their functionality, tools, or description.
              Semantic search will find relevant servers even if they don't contain exact keywords.
            </p>
          </div>
        )}

        {/* No Results */}
        {debouncedQuery && !isLoading && agents.length === 0 && !error && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Search className="h-12 w-12 text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">No results found</h2>
            <p className="text-muted-foreground max-w-md">
              Try different keywords or a more general search term.
            </p>
          </div>
        )}

        {/* Results Grid */}
        {agents.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {agents.map((agent) => (
              <AgentCard
                key={agent.id}
                agent={agent}
                onViewDetails={handleViewDetails}
                onEdit={() => {}}
                onDelete={() => {}}
              />
            ))}
          </div>
        )}
      </div>

      {/* Details Dialog */}
      {selectedAgent && (
        <AgentDetailsDialog
          agent={selectedAgent}
          open={detailsOpen}
          onOpenChange={setDetailsOpen}
        />
      )}
    </div>
  )
}
