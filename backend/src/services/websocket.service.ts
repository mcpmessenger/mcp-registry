import { WebSocketServer, WebSocket } from 'ws'
import { jobTrackerService } from './job-tracker.service'
import type { JobProgressUpdate } from './job-tracker.service'

export interface WebSocketMessage {
  type: 'subscribe' | 'unsubscribe' | 'ping' | 'pong'
  jobId?: string
  payload?: unknown
}

export class WebSocketService {
  private wss: WebSocketServer | null = null
  private jobSubscriptions: Map<string, Set<WebSocket>> = new Map()
  private clientJobs: Map<WebSocket, Set<string>> = new Map()

  /**
   * Initialize WebSocket server
   */
  initialize(server: any) {
    this.wss = new WebSocketServer({
      server,
      path: '/ws',
    })

    this.wss.on('connection', (ws: WebSocket, req) => {
      console.log('WebSocket client connected:', req.socket.remoteAddress)

      // Track client
      this.clientJobs.set(ws, new Set())

      // Handle messages
      ws.on('message', (data: Buffer) => {
        try {
          const message: WebSocketMessage = JSON.parse(data.toString())
          this.handleMessage(ws, message)
        } catch (error) {
          console.error('Error parsing WebSocket message:', error)
          this.sendError(ws, 'Invalid message format')
        }
      })

      // Handle disconnect
      ws.on('close', () => {
        this.handleDisconnect(ws)
      })

      // Handle errors
      ws.on('error', (error) => {
        console.error('WebSocket error:', error)
        this.handleDisconnect(ws)
      })

      // Send connection confirmation
      this.send(ws, {
        type: 'connected',
        message: 'WebSocket connection established',
      })
    })

    console.log('WebSocket server initialized on /ws')
  }

  /**
   * Handle incoming WebSocket message
   */
  private handleMessage(ws: WebSocket, message: WebSocketMessage) {
    switch (message.type) {
      case 'subscribe':
        if (message.jobId) {
          this.subscribeToJob(ws, message.jobId)
        } else {
          this.sendError(ws, 'Job ID required for subscription')
        }
        break

      case 'unsubscribe':
        if (message.jobId) {
          this.unsubscribeFromJob(ws, message.jobId)
        } else {
          this.sendError(ws, 'Job ID required for unsubscription')
        }
        break

      case 'ping':
        this.send(ws, { type: 'pong' })
        break

      default:
        this.sendError(ws, `Unknown message type: ${message.type}`)
    }
  }

  /**
   * Subscribe WebSocket client to job updates
   */
  private async subscribeToJob(ws: WebSocket, jobId: string) {
    // Add to client's job set
    const clientJobs = this.clientJobs.get(ws) || new Set()
    clientJobs.add(jobId)
    this.clientJobs.set(ws, clientJobs)

    // Add to job's client set
    if (!this.jobSubscriptions.has(jobId)) {
      this.jobSubscriptions.set(jobId, new Set())
    }
    this.jobSubscriptions.get(jobId)!.add(ws)

    // Get initial job state
    try {
      const job = await jobTrackerService.getJob(jobId)
      if (job) {
        const latestAsset = job.assets.find((a) => a.isLatest) || job.assets[0]
        this.send(ws, {
          type: 'job_status',
          jobId,
          job: {
            id: job.id,
            status: job.status,
            progress: job.progress,
            progressMessage: job.progressMessage,
            errorMessage: job.errorMessage,
          },
          asset: latestAsset
            ? {
                id: latestAsset.id,
                assetType: latestAsset.assetType,
                content: latestAsset.content,
                url: latestAsset.url,
                version: latestAsset.version,
              }
            : null,
        })

        // If job is still in progress, subscribe to updates
        if (job.status === 'PENDING' || job.status === 'PROCESSING') {
          jobTrackerService.subscribe(jobId, (update: JobProgressUpdate) => {
            this.broadcastToJob(jobId, {
              type: 'job_progress',
              jobId: update.jobId,
              status: update.status,
              progress: update.progress,
              progressMessage: update.progressMessage,
              errorMessage: update.errorMessage,
            })

            // If completed, send final state
            if (update.status === 'COMPLETED' || update.status === 'FAILED') {
              jobTrackerService.getJob(jobId).then((finalJob) => {
                if (finalJob) {
                  const latestAsset = finalJob.assets.find((a) => a.isLatest) || finalJob.assets[0]
                  this.broadcastToJob(jobId, {
                    type: 'job_complete',
                    jobId: finalJob.id,
                    job: {
                      id: finalJob.id,
                      status: finalJob.status,
                      progress: finalJob.progress,
                      progressMessage: finalJob.progressMessage,
                      errorMessage: finalJob.errorMessage,
                      completedAt: finalJob.completedAt,
                    },
                    asset: latestAsset
                      ? {
                          id: latestAsset.id,
                          assetType: latestAsset.assetType,
                          content: latestAsset.content,
                          url: latestAsset.url,
                          version: latestAsset.version,
                        }
                      : null,
                  })
                }
              })
            }
          })
        }
      } else {
        this.sendError(ws, `Job ${jobId} not found`)
      }
    } catch (error) {
      console.error(`Error subscribing to job ${jobId}:`, error)
      this.sendError(ws, `Failed to subscribe to job: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Unsubscribe WebSocket client from job updates
   */
  private unsubscribeFromJob(ws: WebSocket, jobId: string) {
    // Remove from client's job set
    const clientJobs = this.clientJobs.get(ws)
    if (clientJobs) {
      clientJobs.delete(jobId)
    }

    // Remove from job's client set
    const jobClients = this.jobSubscriptions.get(jobId)
    if (jobClients) {
      jobClients.delete(ws)
      if (jobClients.size === 0) {
        this.jobSubscriptions.delete(jobId)
      }
    }

    this.send(ws, {
      type: 'unsubscribed',
      jobId,
    })
  }

  /**
   * Handle client disconnect
   */
  private handleDisconnect(ws: WebSocket) {
    const clientJobs = this.clientJobs.get(ws)
    if (clientJobs) {
      // Unsubscribe from all jobs
      clientJobs.forEach((jobId) => {
        const jobClients = this.jobSubscriptions.get(jobId)
        if (jobClients) {
          jobClients.delete(ws)
          if (jobClients.size === 0) {
            this.jobSubscriptions.delete(jobId)
          }
        }
      })
      this.clientJobs.delete(ws)
    }
  }

  /**
   * Broadcast message to all clients subscribed to a job
   */
  private broadcastToJob(jobId: string, message: unknown) {
    const clients = this.jobSubscriptions.get(jobId)
    if (clients) {
      clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          this.send(client, message)
        } else {
          // Remove dead connections
          clients.delete(client)
        }
      })
    }
  }

  /**
   * Send message to a WebSocket client
   */
  private send(ws: WebSocket, message: unknown) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message))
    }
  }

  /**
   * Send error message to a WebSocket client
   */
  private sendError(ws: WebSocket, error: string) {
    this.send(ws, {
      type: 'error',
      error,
      timestamp: new Date().toISOString(),
    })
  }

  /**
   * Close WebSocket server
   */
  close() {
    if (this.wss) {
      this.wss.close()
    }
  }
}

export const webSocketService = new WebSocketService()
