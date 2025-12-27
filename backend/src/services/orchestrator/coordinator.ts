import { createKafkaConsumer, createKafkaProducer } from './kafka'
import { env } from '../../config/env'
import {
  ToolSignalEvent,
  OrchestratorPlanEvent,
  createOrchestratorResultEvent,
  OrchestratorResultEvent,
} from './events'
import { MCPInvokeService } from '../mcp-invoke.service'
import type { Consumer, Producer } from 'kafkajs'

type ResolutionReason = 'tool' | 'plan'

interface RequestResolution {
  reason: ResolutionReason
  cleanup: ReturnType<typeof setTimeout>
}

const resolveTTL = 5 * 60 * 1000
const resolutionCache = new Map<string, RequestResolution>()

function claimRequest(requestId: string, reason: ResolutionReason): boolean {
  if (resolutionCache.has(requestId)) {
    return false
  }
  const cleanup = setTimeout(() => resolutionCache.delete(requestId), resolveTTL)
  resolutionCache.set(requestId, { reason, cleanup })
  return true
}

function clearResolutionCache() {
  for (const entry of resolutionCache.values()) {
    clearTimeout(entry.cleanup)
  }
  resolutionCache.clear()
}

function logTopic(topic: string, requestId: string, suffix: string) {
  console.log(`[Orchestrator Coordinator] ${topic} ${requestId} ${suffix}`)
}

async function publishResult(
  producer: Producer,
  payload: OrchestratorResultEvent
): Promise<void> {
  console.log(`[Orchestrator Coordinator] Publishing result for request ${payload.requestId} to topic ${env.kafka.topics.orchestratorResults}`)
  await producer.send({
    topic: env.kafka.topics.orchestratorResults,
    messages: [
      {
        key: payload.requestId,
        value: JSON.stringify(payload),
      },
    ],
  })
  console.log(`[Orchestrator Coordinator] Successfully published result for request ${payload.requestId}`)
}

async function handleToolSignal(
  signal: ToolSignalEvent,
  producer: Producer,
  invoker: MCPInvokeService
): Promise<void> {
  if (signal.status !== 'TOOL_READY') {
    logTopic(env.kafka.topics.toolSignals, signal.requestId, 'skipped (not ready)')
    return
  }

  if (!claimRequest(signal.requestId, 'tool')) {
    logTopic(env.kafka.topics.toolSignals, signal.requestId, 'ignored (already resolved)')
    return
  }

  logTopic(env.kafka.topics.toolSignals, signal.requestId, `invoking ${signal.toolId}`)

  try {
    const response = await invoker.invokeTool({
      serverId: signal.serverId,
      tool: signal.toolId,
      arguments: signal.params || {},
    })

    await publishResult(
      producer,
      createOrchestratorResultEvent({
        requestId: signal.requestId,
        status: 'tool',
        tool: signal.toolId,
        toolPath: `${signal.serverId}/${signal.toolId}`,
        result: response.result,
      })
    )
  } catch (error) {
    console.error('[Orchestrator Coordinator] Tool invocation failed', error)
    await publishResult(
      producer,
      createOrchestratorResultEvent({
        requestId: signal.requestId,
        status: 'failed',
        tool: signal.toolId,
        toolPath: `${signal.serverId}/${signal.toolId}`,
        error: error instanceof Error ? error.message : String(error),
      })
    )
  }
}

async function handleOrchestratorPlan(
  plan: OrchestratorPlanEvent,
  producer: Producer
): Promise<void> {
  if (!claimRequest(plan.requestId, 'plan')) {
    logTopic(env.kafka.topics.orchestratorPlans, plan.requestId, 'ignored (already resolved)')
    return
  }

  logTopic(env.kafka.topics.orchestratorPlans, plan.requestId, 'accepting Gemini fallback plan')

  await publishResult(
    producer,
    createOrchestratorResultEvent({
      requestId: plan.requestId,
      status: 'plan',
      plan,
    })
  )
}

let consumerInstance: Consumer | null = null
let producerInstance: Producer | null = null
let shutdownHandler: (() => Promise<void>) | null = null

export async function startExecutionCoordinator(): Promise<() => Promise<void>> {
  if (shutdownHandler) {
    return shutdownHandler
  }

  const invoker = new MCPInvokeService()
  const resultProducer = await createKafkaProducer()

  const consumer = createKafkaConsumer(env.kafka.groupId)
  await consumer.connect()
  await consumer.subscribe({ topic: env.kafka.topics.toolSignals })
  await consumer.subscribe({ topic: env.kafka.topics.orchestratorPlans })

  consumer
    .run({
      eachMessage: async ({ topic, message }) => {
        const value = message.value?.toString()
        if (!value) {
          return
        }

        try {
          const parsed = JSON.parse(value)
          if (topic === env.kafka.topics.toolSignals) {
            await handleToolSignal(parsed as ToolSignalEvent, resultProducer, invoker)
          } else if (topic === env.kafka.topics.orchestratorPlans) {
            await handleOrchestratorPlan(parsed as OrchestratorPlanEvent, resultProducer)
          }
        } catch (error) {
          console.error(
            `[Orchestrator Coordinator] Failed to process ${topic} message`,
            error
          )
        }
      },
    })
    .catch(error => {
      console.error('[Orchestrator Coordinator] Consumer crashed', error)
    })

  consumerInstance = consumer
  producerInstance = resultProducer

  shutdownHandler = async (): Promise<void> => {
    if (consumerInstance) {
      await consumerInstance.stop().catch(error => {
        console.error('[Orchestrator Coordinator] Consumer stop failed', error)
      })
      await consumerInstance.disconnect().catch(error => {
        console.error('[Orchestrator Coordinator] Consumer disconnect failed', error)
      })
      consumerInstance = null
    }

    if (producerInstance) {
      await producerInstance.disconnect().catch(error => {
        console.error('[Orchestrator Coordinator] Producer disconnect failed', error)
      })
      producerInstance = null
    }

    clearResolutionCache()
    shutdownHandler = null
  }

  return shutdownHandler
}

export async function stopExecutionCoordinator(): Promise<void> {
  if (shutdownHandler) {
    await shutdownHandler()
  }
}


