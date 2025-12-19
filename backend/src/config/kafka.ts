import { Kafka } from 'kafkajs'
import { env } from './env'

/**
 * Kafka client instance
 * This is the central nervous system for event-driven architecture
 */
export const kafka = new Kafka({
  clientId: env.kafka.clientId,
  brokers: env.kafka.brokers,
  // Connection timeout
  connectionTimeout: 3000,
  // Request timeout
  requestTimeout: 25000,
  // Retry configuration
  retry: {
    initialRetryTime: 100,
    retries: 8,
  },
})

/**
 * Kafka producer for publishing events
 */
export const kafkaProducer = kafka.producer({
  maxInFlightRequests: 1,
  idempotent: true,
  transactionTimeout: 30000,
})

/**
 * Kafka consumer for consuming events
 */
export const kafkaConsumer = kafka.consumer({
  groupId: env.kafka.groupId,
  sessionTimeout: 30000,
  heartbeatInterval: 3000,
})

/**
 * Initialize Kafka connections
 */
export async function initializeKafka(): Promise<void> {
  try {
    await kafkaProducer.connect()
    console.log('✅ Kafka producer connected')
    
    await kafkaConsumer.connect()
    console.log('✅ Kafka consumer connected')
  } catch (error) {
    console.error('❌ Failed to initialize Kafka:', error)
    throw error
  }
}

/**
 * Gracefully shutdown Kafka connections
 */
export async function shutdownKafka(): Promise<void> {
  try {
    await kafkaProducer.disconnect()
    await kafkaConsumer.disconnect()
    console.log('✅ Kafka connections closed')
  } catch (error) {
    console.error('❌ Error shutting down Kafka:', error)
  }
}
