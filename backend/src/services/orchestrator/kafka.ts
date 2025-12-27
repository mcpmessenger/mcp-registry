import { Kafka, type Consumer, type Producer } from 'kafkajs'
import { env } from '../../config/env'

const kafkaInstance = new Kafka({
  clientId: env.kafka.clientId,
  brokers: env.kafka.brokers,
})

let sharedProducer: Producer | null = null
let producerConnecting = false

/**
 * Get or create a shared Kafka producer (singleton)
 */
export async function createKafkaProducer(): Promise<Producer> {
  if (sharedProducer) {
    return sharedProducer
  }
  
  if (producerConnecting) {
    // Wait for connection to complete
    while (producerConnecting) {
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    if (sharedProducer) {
      return sharedProducer
    }
  }
  
  producerConnecting = true
  try {
    sharedProducer = kafkaInstance.producer()
    await sharedProducer.connect()
    console.log('[Kafka] Producer connected')
    return sharedProducer
  } finally {
    producerConnecting = false
  }
}

/**
 * Create a new Kafka consumer
 */
export function createKafkaConsumer(groupId: string): Consumer {
  return kafkaInstance.consumer({ groupId })
}


