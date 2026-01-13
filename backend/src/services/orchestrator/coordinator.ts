import { createPulsarProducer, createPulsarConsumer, sendPulsarMessage, receivePulsarMessage, type PulsarProducer, type PulsarConsumer } from './pulsar'
import { isPulsarEnabled } from './messaging'
import { env } from '../../config/env'
import {
  ToolSignalEvent,
  OrchestratorPlanEvent,
  createOrchestratorResultEvent,
  OrchestratorResultEvent,
} from './events'
import { MCPInvokeService } from '../mcp-invoke.service'
import { decideRetry, publishDlq, publishRetry } from './retry'

// Helper to get topic name (works for both Kafka and Pulsar)
function getTopic(topicKey: keyof typeof env.pulsar.topics): string {
  return isPulsarEnabled() ? env.pulsar.topics[topicKey] : env.kafka.topics[topicKey]
}

type ResolutionReason = 'tool' | 'plan'

interface RequestResolution {
  reason: ResolutionReason
  cleanup: ReturnType<typeof setTimeout>
}

const resolveTTL = 5 * 60 * 1000
const resolutionCache = new Map<string, RequestResolution>()

function claimRequest(requestId: string, reason: ResolutionReason): boolean {
  const existing = resolutionCache.get(requestId)
  if (existing) {
    // Allow re-processing for the same reason (enables retries),
    // but prevent cross-reason resolution (tool vs plan).
    return existing.reason === reason
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
  producer: PulsarProducer | any, // Support both Pulsar and Kafka
  payload: OrchestratorResultEvent
): Promise<void> {
  const topic = getTopic('orchestratorResults')
  console.log(`[Orchestrator Coordinator] Publishing result for request ${payload.requestId} to topic ${topic}`)
  
  if (isPulsarEnabled()) {
    const pulsarProducer = producer as PulsarProducer
    await sendPulsarMessage(pulsarProducer, payload, { requestId: payload.requestId })
  } else {
    // Kafka producer
    await producer.send({
      topic,
      messages: [
        {
          key: payload.requestId,
          value: JSON.stringify(payload),
        },
      ],
    })
  }
  console.log(`[Orchestrator Coordinator] Successfully published result for request ${payload.requestId}`)
}

async function handleToolSignal(
  signal: ToolSignalEvent,
  producer: PulsarProducer | any, // Support both Pulsar and Kafka
  invoker: MCPInvokeService
): Promise<void> {
  const toolSignalsTopic = getTopic('toolSignals')
  if (signal.status !== 'TOOL_READY') {
    logTopic(toolSignalsTopic, signal.requestId, 'skipped (not ready)')
    return
  }

  if (!claimRequest(signal.requestId, 'tool')) {
    logTopic(toolSignalsTopic, signal.requestId, 'ignored (already resolved)')
    return
  }

  const attempt = signal.attempt ?? 0
  const maxAttempts = signal.maxAttempts ?? 3
  logTopic(
    toolSignalsTopic,
    signal.requestId,
    `invoking ${signal.toolId} (attempt ${attempt + 1}/${maxAttempts})`
  )

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

    const decision = decideRetry(signal, error)
    if (decision.type === 'retry') {
      console.warn(
        `[Orchestrator Coordinator] Scheduling retry for request ${signal.requestId} via topic ${decision.topic}`
      )
      await publishRetry(producer, signal, decision, error)
      return
    }

    if (decision.type === 'dlq') {
      console.error(
        `[Orchestrator Coordinator] Exhausted retries for request ${signal.requestId}; sending to DLQ`
      )
      await publishDlq(producer, signal, error)
    }

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
  producer: PulsarProducer | any // Support both Pulsar and Kafka
): Promise<void> {
  const orchestratorPlansTopic = getTopic('orchestratorPlans')
  if (!claimRequest(plan.requestId, 'plan')) {
    logTopic(orchestratorPlansTopic, plan.requestId, 'ignored (already resolved)')
    return
  }

  logTopic(orchestratorPlansTopic, plan.requestId, 'accepting Gemini fallback plan')

  await publishResult(
    producer,
    createOrchestratorResultEvent({
      requestId: plan.requestId,
      status: 'plan',
      plan,
    })
  )
}

let consumerInstance: PulsarConsumer | any | null = null
let producerInstance: PulsarProducer | any | null = null
let shutdownHandler: (() => Promise<void>) | null = null
let isRunning = false

export async function startExecutionCoordinator(): Promise<() => Promise<void>> {
  if (shutdownHandler) {
    return shutdownHandler
  }

  const invoker = new MCPInvokeService()
  const toolSignalsTopic = getTopic('toolSignals')
  const orchestratorPlansTopic = getTopic('orchestratorPlans')
  const orchestratorResultsTopic = getTopic('orchestratorResults')

  if (isPulsarEnabled()) {
    // Pulsar implementation
    const resultProducer = await createPulsarProducer(orchestratorResultsTopic)
    const toolSignalsConsumer = await createPulsarConsumer(toolSignalsTopic, env.kafka.groupId)
    const plansConsumer = await createPulsarConsumer(orchestratorPlansTopic, env.kafka.groupId)
    
    isRunning = true
    
    // Process tool signals
    const processToolSignals = async () => {
      while (isRunning) {
        try {
          const msg = await receivePulsarMessage(toolSignalsConsumer, 1000)
          if (!msg) continue
          
          try {
            const value = msg.getData().toString()
            const parsed = JSON.parse(value) as ToolSignalEvent
            await handleToolSignal(parsed, resultProducer, invoker)
            toolSignalsConsumer.acknowledge(msg)
          } catch (error) {
            console.error(`[Orchestrator Coordinator] Failed to process tool signal`, error)
            toolSignalsConsumer.negativeAcknowledge(msg)
          }
        } catch (error) {
          if (error instanceof Error && !error.message.includes('timeout')) {
            console.error('[Orchestrator Coordinator] Error in tool signals loop:', error)
          }
        }
      }
    }
    
    // Process orchestrator plans
    const processPlans = async () => {
      while (isRunning) {
        try {
          const msg = await receivePulsarMessage(plansConsumer, 1000)
          if (!msg) continue
          
          try {
            const value = msg.getData().toString()
            const parsed = JSON.parse(value) as OrchestratorPlanEvent
            await handleOrchestratorPlan(parsed, resultProducer)
            plansConsumer.acknowledge(msg)
          } catch (error) {
            console.error(`[Orchestrator Coordinator] Failed to process orchestrator plan`, error)
            plansConsumer.negativeAcknowledge(msg)
          }
        } catch (error) {
          if (error instanceof Error && !error.message.includes('timeout')) {
            console.error('[Orchestrator Coordinator] Error in plans loop:', error)
          }
        }
      }
    }
    
    processToolSignals().catch(error => {
      console.error('[Orchestrator Coordinator] Tool signals loop crashed', error)
    })
    
    processPlans().catch(error => {
      console.error('[Orchestrator Coordinator] Plans loop crashed', error)
    })
    
    consumerInstance = { toolSignals: toolSignalsConsumer, plans: plansConsumer }
    producerInstance = resultProducer
    
    shutdownHandler = async (): Promise<void> => {
      isRunning = false
      if (consumerInstance) {
        await consumerInstance.toolSignals.close().catch(console.error)
        await consumerInstance.plans.close().catch(console.error)
        consumerInstance = null
      }
      if (producerInstance) {
        await producerInstance.close().catch(console.error)
        producerInstance = null
      }
      clearResolutionCache()
      shutdownHandler = null
    }
  } else {
    // Kafka implementation (legacy)
    const { createKafkaConsumer, createKafkaProducer } = await import('./kafka')
    const resultProducer = await createKafkaProducer()
    const consumer = createKafkaConsumer(env.kafka.groupId)
    
    await consumer.connect()
    await consumer.subscribe({ topic: toolSignalsTopic })
    await consumer.subscribe({ topic: orchestratorPlansTopic })

    consumer
      .run({
        eachMessage: async ({ topic, message }) => {
          const value = message.value?.toString()
          if (!value) {
            return
          }

          try {
            const parsed = JSON.parse(value)
            if (topic === toolSignalsTopic) {
              await handleToolSignal(parsed as ToolSignalEvent, resultProducer, invoker)
            } else if (topic === orchestratorPlansTopic) {
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
  }

  return shutdownHandler
}

export async function stopExecutionCoordinator(): Promise<void> {
  if (shutdownHandler) {
    await shutdownHandler()
  }
}


