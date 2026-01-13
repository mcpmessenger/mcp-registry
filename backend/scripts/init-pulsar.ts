/**
 * Pulsar Namespace Initialization Script
 * 
 * Provisions the required tenants, namespaces, and policies for the MCP Registry.
 * Uses the Pulsar Admin REST API to configure the cluster.
 */

import { env } from '../src/config/env'

const PULSAR_ADMIN_URL = env.pulsar.httpUrl

interface PulsarAdminResponse {
    ok: boolean
    status: number
    statusText: string
}

/**
 * Make a request to the Pulsar Admin API
 */
async function pulsarAdminRequest(
    path: string,
    method: 'GET' | 'PUT' | 'POST' | 'DELETE' = 'GET',
    body?: any
): Promise<PulsarAdminResponse> {
    const url = `${PULSAR_ADMIN_URL}${path}`

    try {
        const response = await fetch(url, {
            method,
            headers: {
                'Content-Type': 'application/json',
            },
            body: body ? JSON.stringify(body) : undefined,
        })

        return {
            ok: response.ok,
            status: response.status,
            statusText: response.statusText,
        }
    } catch (error) {
        console.error(`[Pulsar Admin] Request failed: ${method} ${path}`, error)
        throw error
    }
}

/**
 * Create a tenant (if it doesn't exist)
 */
async function createTenant(tenant: string): Promise<void> {
    console.log(`[Pulsar Init] Creating tenant: ${tenant}`)

    const response = await pulsarAdminRequest(
        `/admin/v2/tenants/${tenant}`,
        'PUT',
        {
            allowedClusters: ['standalone'],
            adminRoles: [],
        }
    )

    if (response.ok) {
        console.log(`[Pulsar Init] ✓ Tenant created: ${tenant}`)
    } else if (response.status === 409) {
        console.log(`[Pulsar Init] ℹ Tenant already exists: ${tenant}`)
    } else {
        console.error(`[Pulsar Init] ✗ Failed to create tenant: ${response.status} ${response.statusText}`)
        throw new Error(`Failed to create tenant: ${tenant}`)
    }
}

/**
 * Create a namespace (if it doesn't exist)
 */
async function createNamespace(
    tenant: string,
    namespace: string,
    policies?: {
        retentionTimeMinutes?: number
        retentionSizeMB?: number
        compactionThreshold?: number
    }
): Promise<void> {
    const fullNamespace = `${tenant}/${namespace}`
    console.log(`[Pulsar Init] Creating namespace: ${fullNamespace}`)

    const response = await pulsarAdminRequest(
        `/admin/v2/namespaces/${fullNamespace}`,
        'PUT',
        {}
    )

    if (response.ok) {
        console.log(`[Pulsar Init] ✓ Namespace created: ${fullNamespace}`)
    } else if (response.status === 409) {
        console.log(`[Pulsar Init] ℹ Namespace already exists: ${fullNamespace}`)
    } else {
        console.error(`[Pulsar Init] ✗ Failed to create namespace: ${response.status} ${response.statusText}`)
        throw new Error(`Failed to create namespace: ${fullNamespace}`)
    }

    // Set retention policy if specified
    if (policies) {
        await setRetentionPolicy(fullNamespace, policies)
    }
}

/**
 * Set retention policy for a namespace
 */
async function setRetentionPolicy(
    namespace: string,
    policies: {
        retentionTimeMinutes?: number
        retentionSizeMB?: number
        compactionThreshold?: number
    }
): Promise<void> {
    console.log(`[Pulsar Init] Setting retention policy for: ${namespace}`)

    const { retentionTimeMinutes = -1, retentionSizeMB = -1 } = policies

    const response = await pulsarAdminRequest(
        `/admin/v2/namespaces/${namespace}/retention`,
        'POST',
        {
            retentionTimeInMinutes: retentionTimeMinutes,
            retentionSizeInMB: retentionSizeMB,
        }
    )

    if (response.ok) {
        const retentionDesc = retentionTimeMinutes === -1 ? 'infinite' : `${retentionTimeMinutes} minutes`
        console.log(`[Pulsar Init] ✓ Retention policy set: ${retentionDesc}`)
    } else {
        console.error(`[Pulsar Init] ✗ Failed to set retention policy: ${response.status}`)
    }
}

/**
 * Main initialization function
 */
async function initializePulsar(): Promise<void> {
    console.log('='.repeat(60))
    console.log('[Pulsar Init] Starting Pulsar namespace initialization')
    console.log('[Pulsar Init] Admin URL:', PULSAR_ADMIN_URL)
    console.log('='.repeat(60))

    try {
        // Step 1: Create mcp-core tenant
        await createTenant('mcp-core')

        // Step 2: Create registrations namespace (infinite retention, compacted)
        await createNamespace('mcp-core', 'registrations', {
            retentionTimeMinutes: -1, // Infinite retention
            retentionSizeMB: -1,
        })

        // Step 3: Create sessions namespace (1 hour TTL)
        await createNamespace('mcp-core', 'sessions', {
            retentionTimeMinutes: 60, // 1 hour
            retentionSizeMB: 100, // 100 MB max
        })

        // Step 4: Create events namespace (5 minute TTL for activity events)
        await createNamespace('mcp-core', 'events', {
            retentionTimeMinutes: 5, // 5 minutes
            retentionSizeMB: 50,
        })

        console.log('='.repeat(60))
        console.log('[Pulsar Init] ✓ Initialization complete!')
        console.log('[Pulsar Init] Tenants: mcp-core')
        console.log('[Pulsar Init] Namespaces:')
        console.log('[Pulsar Init]   - mcp-core/registrations (infinite retention)')
        console.log('[Pulsar Init]   - mcp-core/sessions (1 hour TTL)')
        console.log('[Pulsar Init]   - mcp-core/events (5 minute TTL)')
        console.log('='.repeat(60))
    } catch (error) {
        console.error('[Pulsar Init] ✗ Initialization failed:', error)
        process.exit(1)
    }
}

// Run initialization
initializePulsar()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('[Pulsar Init] Fatal error:', error)
        process.exit(1)
    })
