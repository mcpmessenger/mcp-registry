import type { Producer } from 'kafkajs'
import { env } from '../../config/env'
import type { ToolSignalEvent } from './events'

export type RetryDecision =
  | { type: 'retry'; topic: string; delayMs: number; nextAttempt: number }
  | { type: 'dlq'; topic: string }
  | { type: 'no-retry' }

export function isRetryableError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error)
  // Conservative defaults: treat timeouts/transient as retryable.
  if (/timeout|timed out|ETIMEDOUT|ECONNRESET|EAI_AGAIN|ENOTFOUND|503|502|504/i.test(msg)) {
    return true
  }
  // Treat obvious validation/auth errors as non-retryable.
  if (/invalid|validation|schema|unauthorized|forbidden|401|403|400/i.test(msg)) {
    return false
  }
  // Default to retryable for unknown failures (bounded by maxAttempts).
  return true
}

export function decideRetry(signal: ToolSignalEvent, error: unknown): RetryDecision {
  const attempt = signal.attempt ?? 0
  const maxAttempts = signal.maxAttempts ?? 3

  if (!isRetryableError(error)) {
    return { type: 'no-retry' }
  }

  const nextAttempt = attempt + 1
  if (nextAttempt >= maxAttempts) {
    return { type: 'dlq', topic: env.kafka.topics.toolSignalsDlq }
  }

  // Tiered backoff by attempt number
  if (nextAttempt === 1) {
    return { type: 'retry', topic: env.kafka.topics.toolSignalsRetry5s, delayMs: 5000, nextAttempt }
  }
  return { type: 'retry', topic: env.kafka.topics.toolSignalsRetry30s, delayMs: 30000, nextAttempt }
}

export async function publishRetry(
  producer: Producer,
  original: ToolSignalEvent,
  decision: Extract<RetryDecision, { type: 'retry' }>,
  error: unknown
): Promise<void> {
  const msg = error instanceof Error ? error.message : String(error)
  const payload: ToolSignalEvent = {
    ...original,
    attempt: decision.nextAttempt,
    maxAttempts: original.maxAttempts ?? 3,
    lastError: msg,
    timestamp: new Date().toISOString(),
  }

  await producer.send({
    topic: decision.topic,
    messages: [
      {
        key: payload.requestId,
        value: JSON.stringify(payload),
        headers: {
          requestId: payload.requestId,
          attempt: String(payload.attempt ?? 0),
        },
      },
    ],
  })
}

export async function publishDlq(
  producer: Producer,
  original: ToolSignalEvent,
  error: unknown
): Promise<void> {
  const msg = error instanceof Error ? error.message : String(error)
  const payload: ToolSignalEvent = {
    ...original,
    attempt: original.attempt ?? 0,
    maxAttempts: original.maxAttempts ?? 3,
    lastError: msg,
    timestamp: new Date().toISOString(),
  }

  await producer.send({
    topic: env.kafka.topics.toolSignalsDlq,
    messages: [
      {
        key: payload.requestId,
        value: JSON.stringify(payload),
        headers: {
          requestId: payload.requestId,
          attempt: String(payload.attempt ?? 0),
          dlq: 'true',
        },
      },
    ],
  })
}

