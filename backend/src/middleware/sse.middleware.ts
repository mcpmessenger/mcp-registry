import type { Request, Response, NextFunction } from 'express'

export interface SSEOptions {
  headers?: Record<string, string>
}

/**
 * Middleware to set up Server-Sent Events response
 */
export function setupSSE(req: Request, res: Response, next: NextFunction) {
  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no') // Disable nginx buffering

  // Enable CORS for SSE
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'Cache-Control')

  // Send initial connection message
  res.write(': connected\n\n')

  // Handle client disconnect
  req.on('close', () => {
    res.end()
  })

  next()
}

/**
 * Send SSE event
 */
export function sendSSE(res: Response, event: string, data: unknown) {
  const jsonData = JSON.stringify(data)
  res.write(`event: ${event}\n`)
  res.write(`data: ${jsonData}\n\n`)
}

/**
 * Send SSE progress update
 */
export function sendProgress(res: Response, progress: number, message?: string) {
  sendSSE(res, 'progress', {
    progress,
    message,
    timestamp: new Date().toISOString(),
  })
}

/**
 * Send SSE error
 */
export function sendError(res: Response, error: string) {
  sendSSE(res, 'error', {
    error,
    timestamp: new Date().toISOString(),
  })
}

/**
 * Send SSE completion
 */
export function sendComplete(res: Response, data?: unknown) {
  const completeData: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
  }
  
  if (data) {
    completeData.data = data
  }
  
  sendSSE(res, 'complete', completeData)
  res.end()
}
