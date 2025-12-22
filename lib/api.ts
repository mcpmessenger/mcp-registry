/**
 * API Client for MCP Registry Backend
 * Handles all communication with the backend API
 */

const PROD_BACKEND_URL = 'https://mcp-registry-backend-554655392699.us-central1.run.app'
const DEV_BACKEND_URL = 'http://localhost:3001'

// Use environment variable or default based on environment
// NEXT_PUBLIC_API_URL takes precedence if set, otherwise use production URL for production builds
const getApiBaseUrl = () => {
  // Explicitly check for production environment (Vercel sets VERCEL=1)
  const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1'
  
  // Get the env var value if set
  const envUrl = process.env.NEXT_PUBLIC_API_URL
  
  // If we're in production and the env var points to localhost, ignore it and use production URL
  // This prevents accidentally using localhost in production deployments
  if (isProduction && envUrl && envUrl.includes('localhost')) {
    console.warn('NEXT_PUBLIC_API_URL points to localhost in production, using production URL instead')
    return PROD_BACKEND_URL
  }
  
  // If NEXT_PUBLIC_API_URL is explicitly set and not localhost, use it
  if (envUrl && !envUrl.includes('localhost')) {
    return envUrl
  }
  
  // Otherwise, use production URL for production, localhost for development
  return isProduction ? PROD_BACKEND_URL : DEV_BACKEND_URL
}

const API_BASE_URL = getApiBaseUrl()

// Log the API URL being used (helpful for debugging)
if (typeof window !== 'undefined') {
  console.log('[API Client] Using backend URL:', API_BASE_URL)
}

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
 * Supports query parameters for filtering and searching (MCP v0.1 specification)
 * Includes retry logic for Cloud Run cold starts
 */
export async function getServers(options?: {
  search?: string
  capability?: string
  retries?: number
}): Promise<MCPServer[]> {
  const params = new URLSearchParams()
  if (options?.search) {
    params.append('search', options.search)
  }
  if (options?.capability) {
    params.append('capability', options.capability)
  }
  const queryString = params.toString()
  const url = `${API_BASE_URL}/v0.1/servers${queryString ? `?${queryString}` : ''}`
  console.log('Fetching from:', url)
  
  const maxRetries = options?.retries ?? 2
  let lastError: Error | null = null
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      // Exponential backoff: wait 2s, 4s, etc.
      const delay = Math.min(2000 * Math.pow(2, attempt - 1), 10000)
      console.log(`Retrying request (attempt ${attempt + 1}/${maxRetries + 1}) after ${delay}ms...`)
      await new Promise(resolve => setTimeout(resolve, delay))
    }
    
    const controller = new AbortController()
    // Increased timeout to 30 seconds for Cloud Run cold starts
    const timeoutMs = 30000
    const timeoutId = setTimeout(() => {
      console.warn(`Request timeout after ${timeoutMs / 1000} seconds (attempt ${attempt + 1})`)
      controller.abort()
    }, timeoutMs)
    
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
      console.error(`Fetch error (attempt ${attempt + 1}):`, error)
      lastError = error as Error
      
      // Don't retry on certain errors
      if (error instanceof TypeError && error.message.includes('fetch')) {
        // Network error - might be CORS or connectivity issue, retry once
        if (attempt < maxRetries) continue
      }
      
      // If it's the last attempt, throw the error
      if (attempt === maxRetries) {
        if (error instanceof Error && error.name === 'AbortError') {
          throw new Error(`Request timeout after ${maxRetries + 1} attempts. Backend server may be cold-starting or not responding. Check that ${API_BASE_URL} is running.`)
        }
        if (error instanceof TypeError && error.message.includes('fetch')) {
          throw new Error(`Network error: Cannot connect to backend at ${API_BASE_URL}. Make sure the backend server is running and accessible.`)
        }
        throw error
      }
    }
  }
  
  // Should never reach here, but TypeScript needs it
  throw lastError || new Error('Unknown error fetching servers')
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
  const response = await fetch(`${API_BASE_URL}/v0.1/publish`, {
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
  const response = await fetch(`${API_BASE_URL}/v0.1/servers/${encodedId}`, {
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
  const response = await fetch(`${API_BASE_URL}/v0.1/servers/${encodedId}`, {
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
  const controller = new AbortController()
  // Increased timeout to 180 seconds for Playwright browser operations (cold start + browser launch)
  const timeoutMs = 180000
  const timeoutId = setTimeout(() => {
    console.warn(`Invoke request timeout after ${timeoutMs / 1000} seconds`)
    controller.abort()
  }, timeoutMs)
  
  try {
    const response = await fetch(`${API_BASE_URL}/v0.1/invoke`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        serverId: request.serverId || '', // We'll need to pass serverId instead of agentEndpoint
        tool: request.tool,
        arguments: request.arguments,
      }),
    })
    
    clearTimeout(timeoutId)
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: response.statusText }))
      throw new Error(error.error || error.message || `Failed to invoke tool: ${response.statusText}`)
    }
    
    const result = await response.json()
    return result.result || result
  } catch (error) {
    clearTimeout(timeoutId)
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeoutMs / 1000} seconds. The Playwright browser may be taking longer than expected to start.`)
    }
    throw error
  }
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

/**
 * Durable Tasks API (SEP-1686)
 */
export interface DurableTask {
  id: string
  taskId: string
  serverId: string
  server?: {
    serverId: string
    name: string
  }
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED'
  taskType?: string
  description?: string
  input?: Record<string, unknown>
  output?: Record<string, unknown>
  progress: number
  progressMessage?: string
  errorMessage?: string
  metadata?: Record<string, unknown>
  createdAt: string
  updatedAt: string
  completedAt?: string
}

export interface GetTasksResponse {
  success: boolean
  tasks: DurableTask[]
  count: number
}

export interface GetTaskResponse {
  success: boolean
  task: DurableTask
}

export interface CreateTaskRequest {
  taskId: string
  serverId: string
  taskType?: string
  description?: string
  input?: Record<string, unknown>
  metadata?: Record<string, unknown>
}

export interface CreateTaskResponse {
  success: boolean
  message: string
  task: DurableTask
}

/**
 * Get all durable tasks
 */
export async function getTasks(filters?: {
  serverId?: string
  status?: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED'
  taskType?: string
}): Promise<GetTasksResponse> {
  const params = new URLSearchParams()
  if (filters?.serverId) params.append('serverId', filters.serverId)
  if (filters?.status) params.append('status', filters.status)
  if (filters?.taskType) params.append('taskType', filters.taskType)
  
  const queryString = params.toString()
  const url = `${API_BASE_URL}/api/tasks${queryString ? `?${queryString}` : ''}`
  
  const response = await fetch(url)
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }))
    throw new Error(error.message || error.error || `Failed to fetch tasks: ${response.statusText}`)
  }
  
  return response.json()
}

/**
 * Get a specific task by ID
 */
export async function getTask(id: string): Promise<GetTaskResponse> {
  const response = await fetch(`${API_BASE_URL}/api/tasks/${id}`)
  
  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(`Task not found: ${id}`)
    }
    const error = await response.json().catch(() => ({ error: response.statusText }))
    throw new Error(error.message || error.error || `Failed to fetch task: ${response.statusText}`)
  }
  
  return response.json()
}

/**
 * Get tasks for a specific server
 */
export async function getTasksByServer(serverId: string): Promise<GetTasksResponse> {
  const response = await fetch(`${API_BASE_URL}/api/tasks/server/${encodeURIComponent(serverId)}`)
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }))
    throw new Error(error.message || error.error || `Failed to fetch tasks: ${response.statusText}`)
  }
  
  return response.json()
}

/**
 * Security & Trust Scoring API
 */
export interface SecurityScore {
  serverId: string
  name: string
  securityScore: number | null
  lastSecurityScan: string | null
  identityVerified: boolean
}

export interface GetSecurityScoresResponse {
  success: boolean
  servers: SecurityScore[]
  count: number
}

export interface GetSecurityScoreResponse {
  success: boolean
  server: {
    serverId: string
    name: string
    securityScore: number | null
    lastSecurityScan: string | null
    scanResults?: {
      score: number
      npmAudit?: {
        vulnerabilities: number
        critical: number
        high: number
        moderate: number
        low: number
      }
      codeAnalysis?: {
        issues: Array<{
          severity: 'critical' | 'high' | 'medium' | 'low'
          type: string
          description: string
        }>
      }
    }
  }
}

/**
 * Get security scores for all servers
 */
export async function getSecurityScores(): Promise<GetSecurityScoresResponse> {
  const response = await fetch(`${API_BASE_URL}/api/security/scores`)
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }))
    throw new Error(error.message || error.error || `Failed to fetch security scores: ${response.statusText}`)
  }
  
  return response.json()
}

/**
 * Get security score for a specific server
 */
export async function getSecurityScore(serverId: string): Promise<GetSecurityScoreResponse> {
  const response = await fetch(`${API_BASE_URL}/api/security/score/${encodeURIComponent(serverId)}`)
  
  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(`Server not found: ${serverId}`)
    }
    const error = await response.json().catch(() => ({ error: response.statusText }))
    throw new Error(error.message || error.error || `Failed to fetch security score: ${response.statusText}`)
  }
  
  return response.json()
}

/**
 * Trigger security scan for a server
 */
export async function scanServerSecurity(serverId: string): Promise<{ success: boolean; message: string }> {
  const response = await fetch(`${API_BASE_URL}/api/security/scan/${encodeURIComponent(serverId)}`, {
    method: 'POST',
  })
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }))
    throw new Error(error.message || error.error || `Failed to trigger security scan: ${response.statusText}`)
  }
  
  return response.json()
}
