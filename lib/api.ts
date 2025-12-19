/**
 * API Client for MCP Registry Backend
 * Handles all communication with the backend API
 */

// Use environment variable or default to localhost:3001
// In browser, we need to use the full URL
const getApiBaseUrl = () => {
  if (typeof window !== 'undefined') {
    // Client-side: use the same origin or configured URL
    return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
  }
  // Server-side: use the same
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
}

const API_BASE_URL = getApiBaseUrl()

export interface MCPServer {
  serverId: string
  name: string
  description?: string
  version: string
  command?: string
  args?: string[]
  env?: Record<string, string>
  tools: MCPTool[]
  capabilities?: string[]
}

export interface MCPTool {
  name: string
  description: string
  inputSchema: {
    type: string
    properties: Record<string, unknown>
    required?: string[]
  }
}

export interface GenerateSVGRequest {
  description: string
  style?: string
  colorPalette?: string[]
  size?: {
    width: number
    height: number
  }
  serverId?: string
}

export interface GenerateSVGResponse {
  success: boolean
  jobId: string
  assetId?: string
  message: string
}

export interface RefineDesignRequest {
  jobId: string
  instructions: string
}

export interface RefineDesignResponse {
  success: boolean
  jobId: string
  assetId?: string
  message: string
}

export interface JobStatus {
  id: string
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED'
  progress: number
  progressMessage?: string
  errorMessage?: string
  description: string
  createdAt: string
  updatedAt: string
  completedAt?: string
}

export interface Asset {
  id: string
  assetType: string
  content?: string
  url?: string
  version: number
  createdAt: string
}

export interface JobResponse {
  success: boolean
  job: JobStatus
  asset: Asset | null
}

/**
 * Fetch all available MCP servers
 */
export async function getServers(): Promise<MCPServer[]> {
  const url = `${API_BASE_URL}/v0/servers`
  console.log('Fetching from:', url)
  
  const controller = new AbortController()
  const timeoutId = setTimeout(() => {
    console.warn('Request timeout after 5 seconds')
    controller.abort()
  }, 5000) // 5 second timeout (reduced from 10)
  
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
      },
      // Add cache control to prevent hanging
      cache: 'no-cache',
    })
    
    clearTimeout(timeoutId)
    console.log('Response status:', response.status, response.statusText)
    
    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Failed to fetch servers: ${response.status} ${response.statusText} - ${errorText}`)
    }
    
    const data = await response.json()
    console.log('Response data:', data)
    return data
  } catch (error) {
    clearTimeout(timeoutId)
    console.error('Fetch error:', error)
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Request timeout: Backend server may not be responding. Check that http://localhost:3001 is running.')
    }
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new Error('Network error: Cannot connect to backend. Make sure http://localhost:3001 is running.')
    }
    throw error
  }
}

/**
 * Fetch a specific server by ID
 */
export async function getServer(serverId: string): Promise<MCPServer> {
  // URL encode the serverId to handle slashes
  const encodedId = encodeURIComponent(serverId)
  const response = await fetch(`${API_BASE_URL}/v0/servers/${encodedId}`)
  
  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(`Server not found: ${serverId}`)
    }
    throw new Error(`Failed to fetch server: ${response.statusText}`)
  }
  
  return response.json()
}

/**
 * Generate an SVG from a description
 */
export async function generateSVG(request: GenerateSVGRequest): Promise<GenerateSVGResponse> {
  const response = await fetch(`${API_BASE_URL}/api/mcp/tools/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  })
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }))
    throw new Error(error.message || error.error || `Failed to generate SVG: ${response.statusText}`)
  }
  
  return response.json()
}

/**
 * Refine an existing design
 */
export async function refineDesign(request: RefineDesignRequest): Promise<RefineDesignResponse> {
  const response = await fetch(`${API_BASE_URL}/api/mcp/tools/refine`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  })
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }))
    throw new Error(error.message || error.error || `Failed to refine design: ${response.statusText}`)
  }
  
  return response.json()
}

/**
 * Get job status and result
 */
export async function getJobStatus(jobId: string): Promise<JobResponse> {
  const response = await fetch(`${API_BASE_URL}/api/mcp/tools/job/${jobId}`)
  
  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(`Job not found: ${jobId}`)
    }
    throw new Error(`Failed to fetch job status: ${response.statusText}`)
  }
  
  return response.json()
}

/**
 * Create EventSource for SSE job progress streaming
 */
export function createJobProgressStream(jobId: string): EventSource {
  return new EventSource(`${API_BASE_URL}/api/streams/jobs/${jobId}`)
}

/**
 * Publish/register a new MCP server to the registry
 */
export interface PublishServerRequest {
  serverId: string
  name: string
  description?: string
  version?: string
  command?: string
  args?: string[]
  env?: Record<string, string>
  tools?: MCPTool[]
  capabilities?: string[]
  manifest?: Record<string, unknown>
}

export interface PublishServerResponse {
  success: boolean
  message: string
  server: MCPServer
}

export async function publishServer(request: PublishServerRequest): Promise<PublishServerResponse> {
  const response = await fetch(`${API_BASE_URL}/v0/publish`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  })
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }))
    throw new Error(error.message || error.error || `Failed to publish server: ${response.statusText}`)
  }
  
  return response.json()
}

/**
 * Update an existing MCP server
 */
export async function updateServer(serverId: string, request: Partial<PublishServerRequest>): Promise<PublishServerResponse> {
  const encodedId = encodeURIComponent(serverId)
  const response = await fetch(`${API_BASE_URL}/v0/servers/${encodedId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  })
  
  if (!response.ok) {
    const errorText = await response.text()
    let error: any
    try {
      error = JSON.parse(errorText)
    } catch {
      error = { error: errorText || response.statusText }
    }
    
    // Provide more helpful error message
    if (response.status === 404) {
      throw new Error(`Server not found: ${serverId}. The server may have been deleted or the ID is incorrect.`)
    }
    
    throw new Error(error.message || error.error || `Failed to update server: ${response.status} ${response.statusText}`)
  }
  
  return response.json()
}

/**
 * Delete an MCP server from the registry
 */
export async function deleteServer(serverId: string): Promise<{ success: boolean; message: string }> {
  const encodedId = encodeURIComponent(serverId)
  const response = await fetch(`${API_BASE_URL}/v0/servers/${encodedId}`, {
    method: 'DELETE',
  })
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }))
    throw new Error(error.message || error.error || `Failed to delete server: ${response.statusText}`)
  }
  
  return response.json()
}

/**
 * Invoke an MCP tool on a registered agent
 */
export interface InvokeMCPToolRequest {
  serverId: string
  tool: string
  arguments: Record<string, unknown>
  apiKey?: string
}

export interface InvokeMCPToolResponse {
  content: Array<{
    type: 'text' | 'image' | 'resource'
    text?: string
    data?: string
    mimeType?: string
  }>
  isError?: boolean
}

export async function invokeMCPTool(request: InvokeMCPToolRequest): Promise<InvokeMCPToolResponse> {
  // Use backend proxy endpoint to avoid CORS and handle different MCP server types
  const response = await fetch(`${API_BASE_URL}/v0/invoke`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      serverId: request.serverId || '', // We'll need to pass serverId instead of agentEndpoint
      tool: request.tool,
      arguments: request.arguments,
    }),
  })
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }))
    throw new Error(error.error || error.message || `Failed to invoke tool: ${response.statusText}`)
  }
  
  const result = await response.json()
  return result.result || result
}

/**
 * Transcribe audio using Whisper API
 */
export interface TranscribeAudioRequest {
  audioBlob: Blob
  language?: string
}

export interface TranscribeAudioResponse {
  success: boolean
  text: string
  language?: string
  error?: string
}

export async function transcribeAudio(request: TranscribeAudioRequest): Promise<TranscribeAudioResponse> {
  const formData = new FormData()
  formData.append('audio', request.audioBlob, 'audio.webm')
  
  const url = `${API_BASE_URL}/api/audio/transcribe${request.language ? `?language=${request.language}` : ''}`
  console.log('Transcribing audio at:', url)
  console.log('Audio blob size:', request.audioBlob.size, 'bytes')
  console.log('Audio blob type:', request.audioBlob.type)

  try {
    const response = await fetch(url, {
      method: 'POST',
      body: formData,
    })

    console.log('Transcription response status:', response.status, response.statusText)

    if (!response.ok) {
      const errorText = await response.text()
      let error: any
      try {
        error = JSON.parse(errorText)
      } catch {
        error = { error: errorText || response.statusText }
      }
      
      if (response.status === 404) {
        throw new Error(`Transcription endpoint not found. Make sure the backend is running on ${API_BASE_URL}`)
      }
      
      throw new Error(error.error || error.message || `Transcription failed: ${response.status} ${response.statusText}`)
    }

    const result = await response.json()
    console.log('Transcription result:', result)
    return result
  } catch (error) {
    console.error('Transcription fetch error:', error)
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new Error(`Cannot connect to backend at ${API_BASE_URL}. Make sure the backend server is running.`)
    }
    throw error
  }
}

/**
 * Analyze a document using Gemini Vision API
 */
export interface AnalyzeDocumentRequest {
  file: File
  query?: string
}

export interface AnalyzeDocumentResponse {
  success: boolean
  analysis: {
    text?: string
    summary?: string
    insights?: string[]
    labels?: Array<{ description: string; score: number }>
    error?: string
  }
}

export async function analyzeDocument(request: AnalyzeDocumentRequest): Promise<AnalyzeDocumentResponse> {
  const formData = new FormData()
  formData.append('document', request.file)
  
  const url = `${API_BASE_URL}/api/documents/analyze${request.query ? `?query=${encodeURIComponent(request.query)}` : ''}`
  console.log('Analyzing document at:', url)
  console.log('File:', request.file.name, request.file.type, request.file.size, 'bytes')

  try {
    const response = await fetch(url, {
      method: 'POST',
      body: formData,
    })

    console.log('Document analysis response status:', response.status, response.statusText)

    if (!response.ok) {
      const errorText = await response.text()
      let error: any
      try {
        error = JSON.parse(errorText)
      } catch {
        error = { error: errorText || response.statusText }
      }
      
      if (response.status === 404) {
        throw new Error(`Document analysis endpoint not found. Make sure the backend is running on ${API_BASE_URL}`)
      }
      
      throw new Error(error.error || error.message || `Document analysis failed: ${response.status} ${response.statusText}`)
    }

    const result = await response.json()
    console.log('Document analysis result:', result)
    return result
  } catch (error) {
    console.error('Document analysis fetch error:', error)
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new Error(`Cannot connect to backend at ${API_BASE_URL}. Make sure the backend server is running.`)
    }
    throw error
  }
}

/**
 * Health check
 */
export async function healthCheck(): Promise<{ status: string; timestamp: string; environment: string }> {
  const response = await fetch(`${API_BASE_URL}/health`)
  
  if (!response.ok) {
    throw new Error(`Health check failed: ${response.statusText}`)
  }
  
  return response.json()
}
