# MCP Matcher Pulsar Function

This Pulsar Function replaces the separate MCP Matcher microservice, running directly on Pulsar brokers for reduced latency.

## Overview

- **Input Topic**: `persistent://public/default/user-requests`
- **Output Topic**: `persistent://public/default/tool-signals`
- **Function**: Matches user queries to MCP tools using keyword patterns and semantic search

## Deployment

### Prerequisites

- Pulsar cluster running with KoP enabled
- Backend API accessible at `REGISTRY_API_URL` (default: http://localhost:3001)

### Deploy Function

```bash
# From Pulsar broker container or with pulsar-admin CLI
pulsar-admin functions create \
  --name mcp-matcher \
  --tenant public \
  --namespace default \
  --py function.py \
  --inputs persistent://public/default/user-requests \
  --output persistent://public/default/tool-signals \
  --log-topic persistent://public/default/mcp-matcher-logs \
  --processing-guarantees ATLEAST_ONCE \
  --parallelism 1 \
  --user-config '{"REGISTRY_API_URL":"http://localhost:3001","CONFIDENCE_THRESHOLD":"0.7"}'
```

### Or using config file:

```bash
pulsar-admin functions create --function-config-file config.yaml
```

### Update Function

```bash
pulsar-admin functions update --function-config-file config.yaml
```

### Check Function Status

```bash
pulsar-admin functions status --name mcp-matcher --tenant public --namespace default
```

### View Function Logs

```bash
pulsar-admin functions logs --name mcp-matcher --tenant public --namespace default
```

## Configuration

Edit `config.yaml` or use `--user-config` flag:

- `REGISTRY_API_URL`: Backend API URL for server verification (default: http://localhost:3001)
- `CONFIDENCE_THRESHOLD`: Minimum confidence for tool matches (default: 0.7)

## Development

### Local Testing

1. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

2. Test function logic:
   ```python
   from function import match_keyword_pattern, extract_search_params
   
   query = "what's the weather in San Francisco"
   match = match_keyword_pattern(query)
   print(match)
   ```

### Function Structure

- `function.py`: Main function implementation
- `requirements.txt`: Python dependencies
- `config.yaml`: Pulsar function configuration
- `README.md`: This file

## Migration Notes

This function replaces `backend/src/services/orchestrator/matcher.ts` when running on Pulsar.

**Phase II**: Function deployed, coordinator still uses separate service
**Phase III**: Full migration to Pulsar native client
