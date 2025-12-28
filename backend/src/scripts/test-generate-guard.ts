import fetch from 'node-fetch'

async function run() {
  const base = process.env.BACKEND_URL || 'http://localhost:3001'

  console.log('Testing generate guard - 1: generic search (should be rejected)')
  const res1 = await fetch(`${base}/api/mcp/tools/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ description: 'look for Iration concerts in TX' })
  })
  console.log('Status:', res1.status)
  console.log('Body:', await res1.text())

  console.log('\nTesting generate guard - 2: explicit poster request (should be accepted)')
  const res2 = await fetch(`${base}/api/mcp/tools/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ description: 'Create a poster for Iration concerts in TX' })
  })
  console.log('Status:', res2.status)
  console.log('Body:', await res2.text())

  console.log('\nTesting generate guard - 3: override flag (should be accepted)')
  const res3 = await fetch(`${base}/api/mcp/tools/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ description: 'look for Iration concerts in TX', allowImageGeneration: true })
  })
  console.log('Status:', res3.status)
  console.log('Body:', await res3.text())
}

run().catch(err => {
  console.error('Test failed:', err)
  process.exit(1)
})
