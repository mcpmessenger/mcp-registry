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
    console.warn('Request timeout after 10 seconds')
    controller.abort()
  }, 10000) // 10 second timeout
  
  try {
    const response = await fetch(url, {
      signal: controller.signal,
    })
    
    clearTimeout(timeoutId)
    console.log('Response status:', response.status, response.statusText)
    
    if (!response.ok) {
      throw new Error(`Failed to fetch servers: ${response.statusText}`)
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
 * Health check
 */
export async function healthCheck(): Promise<{ status: string; timestamp: string; environment: string }> {
  const response = await fetch(`${API_BASE_URL}/health`)
  
  if (!response.ok) {
    throw new Error(`Health check failed: ${response.statusText}`)
  }
  
  return response.json()
}
