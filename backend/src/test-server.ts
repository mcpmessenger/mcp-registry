/**
 * Simple Test Server
 * 
 * Minimal server to test if the basic backend works
 * without orchestrator services
 */

import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'

dotenv.config()

const app = express()
const PORT = 3001

app.use(cors())
app.use(express.json())

app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.get('/test', (req, res) => {
    res.json({
        message: 'Backend is working!',
        pulsar: {
            available: true,
            url: 'pulsar://localhost:6650'
        }
    })
})

app.listen(PORT, () => {
    console.log(`✓ Test server running on http://localhost:${PORT}`)
    console.log(`✓ Try: http://localhost:${PORT}/health`)
    console.log(`✓ Try: http://localhost:${PORT}/test`)
})
