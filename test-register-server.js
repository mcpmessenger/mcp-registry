/**
 * Quick test script to register a server and see the actual error
 * Run with: node test-register-server.js
 */

const BACKEND_URL = 'https://mcp-registry-backend-554655392699.us-central1.run.app'

const testData = {
  serverId: 'com.mcp-registry/nano-banana-mcp',
  name: 'Nano Banana MCP',
  description: 'npx ["nano-banana-mcp"]',
  version: 'v0.1',
  command: 'npx',
  args: ['nano-banana-mcp'],
  env: {
    API_KEY: 'test-key',
    GEMINI_API_KEY: 'test-key'
  },
  tools: [],
  capabilities: [],
  manifest: {
    serverId: 'com.mcp-registry/nano-banana-mcp'
  },
  metadata: {
    apiKey: '***'
  }
}

async function testRegister() {
  try {
    console.log('Testing server registration...')
    console.log('Request data:', JSON.stringify(testData, null, 2))
    
    const response = await fetch(`${BACKEND_URL}/v0.1/publish`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testData),
    })
    
    const text = await response.text()
    console.log('\nResponse status:', response.status)
    console.log('Response body:', text)
    
    if (!response.ok) {
      try {
        const error = JSON.parse(text)
        console.log('\nParsed error:', JSON.stringify(error, null, 2))
      } catch (e) {
        console.log('\nCould not parse error as JSON')
      }
    }
  } catch (error) {
    console.error('Error:', error)
  }
}

testRegister()

