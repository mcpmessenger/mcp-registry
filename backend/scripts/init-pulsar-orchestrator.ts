/**
 * Pulsar Initialization Script - Orchestrator Namespace
 * 
 * Creates the orchestrator namespace with topics for:
 * - user-requests
 * - tool-signals
 * - orchestrator-plans
 * - orchestrator-results
 * - dlq (dead letter queue)
 */

const PULSAR_HTTP_URL = process.env.PULSAR_HTTP_URL || 'http://localhost:8080'
const TENANT = 'mcp-core'
const NAMESPACE = 'orchestrator'

interface TopicConfig {
    name: string
    retention?: string
    ttl?: string
    compaction?: boolean
}

const TOPICS: TopicConfig[] = [
    {
        name: 'user-requests',
        retention: '7d', // Keep for 7 days
    },
    {
        name: 'tool-signals',
        retention: '24h',
    },
    {
        name: 'orchestrator-plans',
        retention: '24h',
    },
    {
        name: 'orchestrator-results',
        retention: '1h',
    },
    {
        name: 'dlq',
        retention: 'infinite', // Dead letters kept forever for analysis
    },
]

async function initOrchestratorNamespace() {
    console.log(`\n🚀 Initializing Pulsar Orchestrator Namespace`)
    console.log(`   Tenant: ${TENANT}`)
    console.log(`   Namespace: ${NAMESPACE}`)
    console.log(`   Pulsar URL: ${PULSAR_HTTP_URL}\n`)

    try {
        // Create namespace
        console.log(`📦 Creating namespace: ${TENANT}/${NAMESPACE}`)
        const nsResponse = await fetch(
            `${PULSAR_HTTP_URL}/admin/v2/namespaces/${TENANT}/${NAMESPACE}`,
            {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
            }
        )

        if (nsResponse.ok || nsResponse.status === 409) {
            console.log(`   ✅ Namespace ready\n`)
        } else {
            const error = await nsResponse.text()
            console.error(`   ❌ Failed: ${error}`)
            process.exit(1)
        }

        // Create topics
        for (const topic of TOPICS) {
            console.log(`📝 Creating topic: ${topic.name}`)
            const topicName = `persistent://${TENANT}/${NAMESPACE}/${topic.name}`

            const topicResponse = await fetch(
                `${PULSAR_HTTP_URL}/admin/v2/persistent/${TENANT}/${NAMESPACE}/${topic.name}/partitions`,
                {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(1), // Non-partitioned
                }
            )

            if (topicResponse.ok || topicResponse.status === 409) {
                console.log(`   ✅ Topic created`)

                // Set retention policy
                if (topic.retention) {
                    console.log(`   🕐 Setting retention: ${topic.retention}`)
                    const retentionMs = parseRetention(topic.retention)
                    const retentionResponse = await fetch(
                        `${PULSAR_HTTP_URL}/admin/v2/namespaces/${TENANT}/${NAMESPACE}/retention`,
                        {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                retentionTimeInMinutes: Math.floor(retentionMs / 60000),
                                retentionSizeInMB: -1, // No size limit
                            }),
                        }
                    )
                    if (retentionResponse.ok) {
                        console.log(`   ✅ Retention configured`)
                    }
                }
            } else {
                const error = await topicResponse.text()
                console.warn(`   ⚠️  Warning: ${error}`)
            }
            console.log()
        }

        console.log(`\n✅ Orchestrator namespace initialized successfully!`)
        console.log(`\nTopics created:`)
        TOPICS.forEach(t => {
            console.log(`   - persistent://${TENANT}/${NAMESPACE}/${t.name}`)
        })

    } catch (error) {
        console.error(`\n❌ Error initializing namespace:`, error)
        process.exit(1)
    }
}

function parseRetention(retention: string): number {
    const match = retention.match(/^(\d+)([dhm])$/)
    if (!match) return 0

    const value = parseInt(match[1])
    const unit = match[2]

    switch (unit) {
        case 'd': return value * 24 * 60 * 60 * 1000 // days to ms
        case 'h': return value * 60 * 60 * 1000 // hours to ms
        case 'm': return value * 60 * 1000 // minutes to ms
        default: return 0
    }
}

// Run
initOrchestratorNamespace()
