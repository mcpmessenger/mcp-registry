import { eventBusConsumerService } from './event-bus-consumer.service'
import { registryService } from './registry.service'
import type { MCPEvent } from './event-bus.service'

/**
 * Example workflow: When vision is captured, automatically process with researcher
 * 
 * This demonstrates cross-server event-driven workflows:
 * 1. Playwright captures a screenshot (vision.captured event)
 * 2. Researcher server automatically processes it
 * 3. Results are stored in memory for future reference
 */
export function setupVisionToResearcherWorkflow() {
  // Subscribe to vision.captured events from Playwright
  eventBusConsumerService.registerHandler('vision.captured', async (event: MCPEvent) => {
    console.log('🔔 Vision captured event received:', event.event)
    console.log('   Server:', event.serverId)
    console.log('   Payload:', event.payload)

    try {
      // Find researcher server (if registered)
      const researcherServer = await registryService.getServerById('com.researcher/mcp')
      
      if (!researcherServer) {
        console.log('⚠️  Researcher server not found - skipping automatic processing')
        return
      }

      // Extract image data from event payload
      const imageData = event.payload.result?.content?.find(
        (c: any) => c.type === 'image'
      )

      if (!imageData) {
        console.log('⚠️  No image data in vision.captured event')
        return
      }

      // Here you would invoke the researcher tool with the image
      // For now, we'll just log it
      console.log('📊 Would process image with researcher server')
      console.log('   Image type:', imageData.mimeType)
      console.log('   Image size:', imageData.data?.length || 0, 'bytes')

      // In a real implementation, you would:
      // 1. Call the researcher tool via the invoke endpoint
      // 2. Store results in memory using memoryService.upsertContext()
      // 3. Emit a researcher.processed event for other servers

    } catch (error) {
      console.error('❌ Error in vision-to-researcher workflow:', error)
    }
  })

  console.log('✅ Vision-to-Researcher workflow registered')
}

/**
 * Example: Data processing workflow
 * When data is processed, automatically visualize it
 */
export function setupDataToVisualizationWorkflow() {
  eventBusConsumerService.registerHandler('data.processed', async (event: MCPEvent) => {
    console.log('🔔 Data processed event received:', event.event)
    
    // Find visualization server
    // Process data
    // Generate visualization
    // Store in memory
  })

  console.log('✅ Data-to-Visualization workflow registered')
}
