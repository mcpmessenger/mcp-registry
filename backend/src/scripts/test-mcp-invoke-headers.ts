import express from 'express'
import bodyParser from 'body-parser'
import { registryService } from '../services/registry.service'
import { MCPInvokeService } from '../services/mcp-invoke.service'

async function main() {
  const port = 30999
  const app = express()
  app.use(bodyParser.json())

  app.post('/mcp/invoke', (req, res) => {
    const accept = req.headers['accept'] as string | undefined
    if (!accept || !accept.includes('application/json') || !accept.includes('text/event-stream')) {
      res.status(406).send('Not Acceptable: Client must accept both application/json and text/event-stream')
      return
    }

    res.json({ receivedHeaders: req.headers, body: req.body })
  })

  const server = app.listen(port, async () => {
    console.log(`Test echo server listening on http://localhost:${port}`)

    // Publish a temporary test server
    const serverData = {
      serverId: 'test/echo-mcp',
      name: 'Test Echo MCP',
      description: 'Local test server for validating MCPInvoke headers',
      metadata: {
        endpoint: `http://localhost:${port}`,
        apiFormat: 'custom',
      },
      tools: [
        {
          name: 'echo_tool',
          description: 'Echoes back the request',
          inputSchema: { type: 'object' },
        },
      ],
    }

    try {
      await registryService.publishServer(serverData as any)
      console.log('Published test server to registry: test/echo-mcp')

      const invoker = new MCPInvokeService()
      const result = await invoker.invokeTool({ serverId: 'test/echo-mcp', tool: 'echo_tool', arguments: { sample: 'data' } })

      console.log('Invoke result:', JSON.stringify(result, null, 2))
    } catch (err) {
      console.error('Error during test invoke:', err)
    } finally {
      // Cleanup: close server and exit process
      server.close(() => {
        console.log('Test echo server closed')
        process.exit(0)
      })
    }
  })
}

main().catch(err => {
  console.error('Test script failed:', err)
  process.exit(1)
})
