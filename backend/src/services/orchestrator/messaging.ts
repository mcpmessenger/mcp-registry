/**
 * Unified Messaging Interface
 * 
 * Provides a unified interface for both Kafka and Pulsar messaging.
 * Automatically selects the appropriate implementation based on configuration.
 */

import { env } from '../../config/env'
import { createPulsarProducer, createPulsarConsumer, sendPulsarMessage, receivePulsarMessage, PulsarProducer, PulsarConsumer } from './pulsar'
import type Pulsar from 'pulsar-client'

// Lazy import Kafka types to avoid loading kafka.ts when Pulsar is enabled
export type KafkaProducer = import('./kafka').KafkaProducer
export type KafkaConsumer = import('./kafka').KafkaConsumer

export type MessageProducer = KafkaProducer | PulsarProducer
export type MessageConsumer = KafkaConsumer | PulsarConsumer

export interface MessageHandler {
  (message: { value: Buffer | string; key?: string; headers?: Record<string, string> }): Promise<void>
}

/**
 * Create a producer (Kafka or Pulsar based on configuration)
 */
export async function createProducer(topic: string): Promise<MessageProducer> {
  if (env.pulsar.enabled) {
    return await createPulsarProducer(topic)
  } else {
    const { createKafkaProducer } = await import('./kafka')
    return await createKafkaProducer() as MessageProducer
  }
}

/**
 * Create a consumer (Kafka or Pulsar based on configuration)
 */
export async function createConsumer(topic: string, groupId: string): Promise<MessageConsumer> {
  if (env.pulsar.enabled) {
    return await createPulsarConsumer(topic, groupId)
  } else {
    const { createKafkaConsumer } = await import('./kafka')
    return createKafkaConsumer(groupId) as MessageConsumer
  }
}

/**
 * Send a message (works with both Kafka and Pulsar)
 */
export async function sendMessage(
  producer: MessageProducer,
  topic: string,
  message: string | object,
  key?: string,
  headers?: Record<string, string>
): Promise<void> {
  if (env.pulsar.enabled) {
    const pulsarProducer = producer as PulsarProducer
    await sendPulsarMessage(pulsarProducer, message, headers)
  } else {
    const kafkaProducer = producer as KafkaProducer
    await kafkaProducer.send({
      topic,
      messages: [{
        key,
        value: typeof message === 'string' ? message : JSON.stringify(message),
        headers,
      }],
    })
  }
}

/**
 * Get topic name (with namespace prefix for Pulsar)
 */
export function getTopicName(topic: string): string {
  if (env.pulsar.enabled) {
    return `persistent://${env.pulsar.namespace}/${topic}`
  }
  return topic
}

/**
 * Check if using Pulsar
 */
export function isPulsarEnabled(): boolean {
  return env.pulsar.enabled
}
