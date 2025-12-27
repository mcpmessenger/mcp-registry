# Seed Stock MCP Servers

This guide shows how to seed the stock MCP servers (Playwright, LangChain, Google Maps, Valuation) in your deployed backend.

## Quick Seed (Cloud Run Job)

Run the seed script using a Cloud Run job (recommended for production):

```bash
# Set your project variables
export PROJECT_ID=$(gcloud config get-value project)
export DB_CONNECTION_NAME=$(gcloud sql instances describe mcp-registry-db --format="value(connectionName)")

# Create seed job
gcloud run jobs create seed-stock-servers \
  --image gcr.io/$PROJECT_ID/mcp-registry-backend \
  --region us-central1 \
  --add-cloudsql-instances $DB_CONNECTION_NAME \
  --set-env-vars "NODE_ENV=production" \
  --set-secrets "GOOGLE_GEMINI_API_KEY=google-gemini-api-key:latest" \
  --set-env-vars "DATABASE_URL=postgresql://postgres:$(gcloud secrets versions access latest --secret=db-password)@/$DB_CONNECTION_NAME/mcp_registry?host=/cloudsql/$DB_CONNECTION_NAME" \
  --command npm \
  --args "run,seed"

# (Optional) If you have an Exa API key, create a secret and include it when creating the job:
# gcloud secrets create exa-api-key --replication-policy="automatic" --data-file="-"
# gcloud secrets versions add exa-api-key --data-file=<(echo -n "YOUR_EXA_API_KEY")
# Then add it to the job via --set-secrets "EXA_API_KEY=exa-api-key:latest"
# This will populate process.env.EXA_API_KEY for the seeding script to inject Authorization headers for Exa.

# Execute the seed job
gcloud run jobs execute seed-stock-servers --region us-central1
```

## Alternative: One-time Execution

If you prefer a one-time execution without creating a job:

```bash
gcloud run jobs execute seed-stock-servers --region us-central1 --wait
```

## Verify Stock Servers

After seeding, verify the servers are registered:

```bash
# Get your backend URL
export BACKEND_URL=$(gcloud run services describe mcp-registry-backend \
  --platform managed \
  --region us-central1 \
  --format="value(status.url)")

# Check servers
curl $BACKEND_URL/v0.1/servers | jq '.[] | {serverId, name}'
```

You should see:
- `com.microsoft.playwright/mcp` - Playwright MCP Server
- `com.langchain/agent-mcp-server` - LangChain Agent MCP Server
- `com.google/maps-mcp` - Google Maps MCP (Grounding Lite)
- `com.valuation/mcp-server` - Valuation Analysis MCP Server

## Troubleshooting

### Job Fails with Database Connection Error

Ensure:
1. Cloud SQL instance is running
2. `DATABASE_URL` is correctly formatted
3. Cloud Run service has Cloud SQL connection configured

### Servers Already Exist

The seed script handles existing servers gracefully - it will update them if they already exist. You can run the seed job multiple times safely.

### Check Job Logs

```bash
gcloud run jobs executions list --job seed-stock-servers --region us-central1 --limit 1
# Get the execution name from above, then:
gcloud run jobs executions logs read <EXECUTION_NAME> --region us-central1
```

## Auto-Seed on Deployment (Future Enhancement)

To automatically seed on deployment, you could:
1. Add a startup script that checks if servers exist and seeds if needed
2. Use Cloud Build to run seed after migrations
3. Add a health check endpoint that triggers seeding if servers are missing

