# Pulsar Multi-Tenant Architecture

This document describes the multi-tenant namespace structure for isolating agent execution environments.

## Namespace Structure

Pulsar uses a hierarchical namespace structure: `tenant/namespace`

### Design

```
tenant/
  ├── {user-id}/
  │   └── orchestrator/          # User-specific orchestration topics
  │       ├── user-requests
  │       ├── tool-signals
  │       └── orchestrator-results
  │
  ├── {agent-id}/
  │   └── execution/              # Agent-specific execution logs
  │       ├── tool-signals
  │       ├── orchestrator-results
  │       └── execution-logs
  │
  └── shared/
      └── registry/               # Shared topics (tool registry updates)
          └── mcp-server-events
```

### Topic Naming

Full topic names follow the pattern: `persistent://{tenant}/{namespace}/{topic-name}`

Examples:
- `persistent://tenant/user-123/orchestrator/user-requests`
- `persistent://tenant/agent-456/execution/tool-signals`
- `persistent://public/shared/registry/mcp-server-events`

## Implementation

### Namespace Creation

```bash
# Create user namespace
pulsar-admin namespaces create tenant/user-123/orchestrator

# Create agent namespace
pulsar-admin namespaces create tenant/agent-456/execution

# Create shared namespace
pulsar-admin namespaces create public/shared/registry
```

### Namespace Policies

Configure retention, replication, and access control per namespace:

```bash
# Set retention policy (7 days hot, 90 days cold)
pulsar-admin namespaces set-retention \
  tenant/user-123/orchestrator \
  --size -1 \
  --time 7d

# Set replication factor
pulsar-admin namespaces set-replication-clusters \
  tenant/user-123/orchestrator \
  --clusters cluster-a

# Configure tiered storage offload
pulsar-admin namespaces set-offload-threshold \
  tenant/user-123/orchestrator \
  --size 10G
```

### Access Control Lists (ACLs)

```bash
# Grant user access to their namespace
pulsar-admin namespaces grant-permission \
  tenant/user-123/orchestrator \
  --roles user-123 \
  --actions produce,consume

# Grant agent access to execution namespace
pulsar-admin namespaces grant-permission \
  tenant/agent-456/execution \
  --roles agent-456 \
  --actions produce,consume
```

## Routing Logic

The Ingress Gateway determines the namespace based on request context:

1. **User Requests**: Extract `user_id` from session/context → `tenant/{user-id}/orchestrator`
2. **Agent Requests**: Extract `agent_id` from context → `tenant/{agent-id}/execution`
3. **Shared Events**: Use `public/shared/registry` for tool registry updates

### Code Example

```typescript
function getNamespace(request: UserRequest): string {
  // Check for user ID
  if (request.userId) {
    return `tenant/${request.userId}/orchestrator`
  }
  
  // Check for agent ID
  if (request.agentId) {
    return `tenant/${request.agentId}/execution`
  }
  
  // Default to public namespace
  return 'public/default'
}

const namespace = getNamespace(request)
const topic = `persistent://${namespace}/user-requests`
```

## Data Isolation

### Per-Tenant Isolation

- Each user/agent has isolated topics
- No cross-tenant data access
- Separate consumer groups per namespace

### Execution Log Isolation

Agent execution logs are stored in agent-specific namespaces:
- `tenant/{agent-id}/execution/tool-signals`
- `tenant/{agent-id}/execution/orchestrator-results`
- `tenant/{agent-id}/execution/execution-logs`

This ensures sensitive execution data doesn't leak into shared contexts.

## Tiered Storage

### Configuration

```bash
# Enable tiered storage for execution logs namespace
pulsar-admin namespaces set-offload-threshold \
  tenant/agent-456/execution \
  --size 1G

# Configure offload destination (GCS)
pulsar-admin broker-config set-tieredStorageEnabled true
pulsar-admin broker-config set-tieredStorageProvider gcs
pulsar-admin broker-config set-tieredStorageGcsBucket my-pulsar-logs
```

### Retention Policies

- **Hot Storage**: 7 days (frequent access)
- **Cold Storage**: 90 days (execution logs, audit trail)
- **Offload Trigger**: Size-based (1GB) or time-based (7 days)

## Monitoring

### Namespace Metrics

```bash
# Get namespace stats
pulsar-admin namespaces stats tenant/user-123/orchestrator

# Monitor throughput per namespace
pulsar-admin topics stats persistent://tenant/user-123/orchestrator/user-requests
```

### Per-Namespace Alerts

- Storage usage > 80%
- Message backlog > 10,000
- Consumer lag > 5 minutes
- Tiered storage offload failures

## Migration Path

### Phase III Implementation

1. **Namespace Creation**: Script to create namespaces for existing users/agents
2. **Routing Update**: Ingress gateway routes to appropriate namespace
3. **Data Migration**: Move existing topics to new namespace structure
4. **ACL Configuration**: Set up access control per namespace
5. **Tiered Storage**: Configure offload for execution logs

### Backward Compatibility

During migration, support both:
- Old: `public/default/user-requests` (shared namespace)
- New: `tenant/{user-id}/orchestrator/user-requests` (isolated)

Gradually migrate users to new namespace structure.

## Security Considerations

1. **Namespace Isolation**: Ensure no cross-namespace access
2. **ACL Enforcement**: Verify permissions at broker level
3. **Schema Isolation**: Per-namespace schema registry
4. **Audit Logging**: Track namespace access and operations

## References

- [Pulsar Multi-Tenancy](https://pulsar.apache.org/docs/administration-tenant/)
- [Namespace Management](https://pulsar.apache.org/docs/administration-namespaces/)
- [Tiered Storage](https://pulsar.apache.org/docs/tiered-storage/)
