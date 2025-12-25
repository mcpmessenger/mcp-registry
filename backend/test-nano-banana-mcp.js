/**
 * Test script to manually invoke Nano Banana MCP server
 * This will show us exactly what the server returns
 * 
 * Usage: node test-nano-banana-mcp.js
 */

const { spawn } = require('child_process')
const readline = require('readline')

async function testNanoBananaMCP() {
  console.log('🧪 Testing Nano Banana MCP Server...\n')
  
  // Spawn the MCP server process
  const proc = spawn('npx', ['-y', 'nano-banana-mcp'], {
    stdio: ['pipe', 'pipe', 'pipe'],
    shell: true,
    env: {
      ...process.env,
      GEMINI_API_KEY: process.env.GEMINI_API_KEY || 'YOUR_API_KEY_HERE', // Replace with actual key
    },
  })

  let initRequestId = 1
  let toolRequestId = 2
  let state = 'INITIALIZING'
  let stdoutBuffer = ''

  // Create readline interface for line-buffered reading
  const rl = readline.createInterface({
    input: proc.stdout,
    terminal: false,
  })

  // Handle each line (JSON-RPC message)
  rl.on('line', (line) => {
    if (!line.trim()) return
    
    try {
      const message = JSON.parse(line)
      console.log('📨 Received:', JSON.stringify(message, null, 2))
      
      // Handle initialize response
      if (message.id === initRequestId && state === 'INITIALIZING') {
        if (message.error) {
          console.error('❌ Initialize error:', message.error)
          proc.kill()
          process.exit(1)
        }
        
        if (message.result) {
          state = 'INITIALIZED'
          console.log('✅ Initialize successful\n')
          
          // Send initialized notification
          const initializedNotification = {
            jsonrpc: '2.0',
            method: 'notifications/initialized',
          }
          proc.stdin.write(JSON.stringify(initializedNotification) + '\n')
          console.log('📤 Sent initialized notification\n')
          
          // Now send the tool call
          state = 'CALLING'
          const toolRequest = {
            jsonrpc: '2.0',
            id: toolRequestId,
            method: 'tools/call',
            params: {
              name: 'generate_image',
              arguments: {
                prompt: 'A simple red circle on white background',
              },
            },
          }
          
          proc.stdin.write(JSON.stringify(toolRequest) + '\n')
          console.log('📤 Sent tool call:', JSON.stringify(toolRequest, null, 2))
          console.log('\n⏳ Waiting for response...\n')
        }
      }
      // Handle tool call response
      else if (message.id === toolRequestId && state === 'CALLING') {
        state = 'COMPLETE'
        console.log('✅ Tool call completed!\n')
        console.log('📊 Full Response Structure:')
        console.log(JSON.stringify(message, null, 2))
        console.log('\n')
        
        // Analyze the result
        if (message.result) {
          console.log('🔍 Result Analysis:')
          console.log('  - Has result:', !!message.result)
          console.log('  - Result type:', typeof message.result)
          
          if (message.result.content) {
            console.log('  - Has content:', !!message.result.content)
            console.log('  - Content type:', Array.isArray(message.result.content) ? 'array' : typeof message.result.content)
            
            if (Array.isArray(message.result.content)) {
              console.log('  - Content items:', message.result.content.length)
              message.result.content.forEach((item, index) => {
                console.log(`\n  Item ${index}:`)
                console.log('    - Type:', item.type)
                console.log('    - Has text:', !!item.text)
                console.log('    - Has data:', !!item.data)
                console.log('    - Has url:', !!item.url)
                console.log('    - Has mimeType:', !!item.mimeType)
                if (item.text) {
                  console.log('    - Text (first 200 chars):', item.text.substring(0, 200))
                }
                if (item.url) {
                  console.log('    - URL:', item.url)
                }
              })
            } else {
              console.log('  - Content:', JSON.stringify(message.result.content, null, 2))
            }
          } else {
            console.log('  - No content field')
            console.log('  - Full result:', JSON.stringify(message.result, null, 2))
          }
        } else if (message.error) {
          console.error('❌ Tool call error:', message.error)
        }
        
        proc.kill()
        rl.close()
        process.exit(0)
      }
    } catch (e) {
      console.error('❌ Failed to parse line:', line.substring(0, 100), e.message)
    }
  })

  // Handle stderr
  proc.stderr.on('data', (data) => {
    const message = data.toString()
    if (!message.includes('Downloading') && !message.includes('Installing') && !message.includes('npm')) {
      console.error('⚠️  stderr:', message.trim())
    }
  })

  // Handle process errors
  proc.on('error', (error) => {
    console.error('❌ Process error:', error.message)
    process.exit(1)
  })

  proc.on('exit', (code, signal) => {
    if (state !== 'COMPLETE') {
      console.error(`❌ Process exited with code ${code} (signal: ${signal}) before completion`)
      console.error('State:', state)
      process.exit(1)
    }
  })

  // Send initialize request
  const initRequest = {
    jsonrpc: '2.0',
    id: initRequestId,
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: {
        name: 'test-script',
        version: '1.0.0',
      },
    },
  }

  proc.stdin.write(JSON.stringify(initRequest) + '\n')
  console.log('📤 Sent initialize request:', JSON.stringify(initRequest, null, 2))
  console.log('\n⏳ Waiting for initialize response...\n')

  // Timeout after 60 seconds
  setTimeout(() => {
    if (state !== 'COMPLETE') {
      console.error('❌ Timeout after 60 seconds')
      proc.kill()
      rl.close()
      process.exit(1)
    }
  }, 60000)
}

// Run the test
testNanoBananaMCP().catch(console.error)

