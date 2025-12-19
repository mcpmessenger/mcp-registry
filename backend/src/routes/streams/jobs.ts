import { Router } from 'express'
import { setupSSE, sendSSE, sendProgress, sendError, sendComplete } from '../../middleware/sse.middleware'
import { jobTrackerService } from '../../services/job-tracker.service'
import type { JobProgressUpdate } from '../../services/job-tracker.service'

const router = Router()

/**
 * GET /api/streams/jobs/:jobId
 * SSE endpoint for streaming job progress updates
 */
router.get('/jobs/:jobId', setupSSE, async (req, res, next) => {
  const { jobId } = req.params

  try {
    // Get initial job state
    const job = await jobTrackerService.getJob(jobId)

    if (!job) {
      sendError(res, 'Job not found')
      return res.end()
    }

    // Send initial state
    sendSSE(res, 'status', {
      jobId: job.id,
      status: job.status,
      progress: job.progress,
      progressMessage: job.progressMessage,
      errorMessage: job.errorMessage,
    })

    // If job is already completed or failed, send final state and close
    if (job.status === 'COMPLETED' || job.status === 'FAILED') {
      const latestAsset = job.assets.find((a) => a.isLatest) || job.assets[0]
      sendComplete(res, {
        job: {
          id: job.id,
          status: job.status,
          progress: job.progress,
          progressMessage: job.progressMessage,
          errorMessage: job.errorMessage,
          completedAt: job.completedAt,
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
      return
    }

    // Subscribe to progress updates
    const unsubscribe = jobTrackerService.subscribe(jobId, (update: JobProgressUpdate) => {
      sendSSE(res, 'progress', {
        jobId: update.jobId,
        status: update.status,
        progress: update.progress,
        progressMessage: update.progressMessage,
        errorMessage: update.errorMessage,
        timestamp: new Date().toISOString(),
      })

      // If job is completed or failed, send final state and close
      if (update.status === 'COMPLETED' || update.status === 'FAILED') {
        // Get final job state with assets
        jobTrackerService.getJob(jobId).then((finalJob) => {
          if (finalJob) {
            const latestAsset = finalJob.assets.find((a) => a.isLatest) || finalJob.assets[0]
            sendComplete(res, {
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
          } else {
            sendComplete(res, {
              job: {
                id: update.jobId,
                status: update.status,
                progress: update.progress,
                progressMessage: update.progressMessage,
                errorMessage: update.errorMessage,
              },
            })
          }
        })
      }
    })

    // Cleanup on client disconnect
    req.on('close', () => {
      unsubscribe()
    })

    // Send periodic heartbeat to keep connection alive
    const heartbeatInterval = setInterval(() => {
      if (res.writableEnded) {
        clearInterval(heartbeatInterval)
        unsubscribe()
        return
      }
      res.write(': heartbeat\n\n')
    }, 30000) // Every 30 seconds

    // Cleanup heartbeat on disconnect
    req.on('close', () => {
      clearInterval(heartbeatInterval)
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    sendError(res, errorMessage)
    res.end()
  }
})

export default router
