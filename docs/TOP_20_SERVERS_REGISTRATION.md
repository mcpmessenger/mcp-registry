# Top 20 MCP Servers Registration

This document explains how to bulk-register the top 20 Model Context Protocol (MCP) servers into the slashmcp.com registry.

## Overview

The registration system consists of:
1. **Manifest File** (`backend/data/top-20-servers.json`) - Contains configuration for all 20 servers
2. **Registration Script** (`backend/src/scripts/register-top-20-servers.ts`) - TypeScript script that reads the manifest and registers servers
3. **Shell Scripts** - Convenience scripts for easy execution

## Quick Start

### Option 1: Using npm script (Recommended)

From the `backend/` directory:

```bash
npm run register-top-20
```

### Option 2: Using PowerShell (Windows)

From the project root:

```powershell
.\scripts\register-top-20-servers.ps1
```

### Option 3: Using Bash (Linux/Mac)

From the project root:

```bash
chmod +x scripts/register-top-20-servers.sh
./scripts/register-top-20-servers.sh
```

### Option 4: Direct TypeScript execution

From the `backend/` directory:

```bash
npx ts-node src/scripts/register-top-20-servers.ts
```

## Server Manifest Format

The manifest file (`backend/data/top-20-servers.json`) contains an array of server configurations:

```json
{
  "id": "playwright",
  "name": "Playwright",
  "description": "Browser automation and web scraping.",
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-playwright"],
  "env": []
}
```

### Fields

- **id**: Unique identifier (used to generate `serverId` as `modelcontextprotocol/{id}`)
- **name**: Display name for the server
- **description**: Brief description of what the server does
- **command**: Command to run (typically `npx`)
- **args**: Array of command arguments (typically `["-y", "@package/name"]`)
- **env**: Array of required environment variable names (e.g., `["GITHUB_PERSONAL_ACCESS_TOKEN"]`)

## Registered Servers

The following 20 servers are included in the manifest:

1. **Playwright** - Browser automation and web scraping
2. **GitHub** - Manage repositories, issues, and PRs (requires `GITHUB_PERSONAL_ACCESS_TOKEN`)
3. **Google Maps** - Location services and place details (requires `GOOGLE_MAPS_API_KEY`)
4. **Postgres** - PostgreSQL database access (requires `DATABASE_URL`)
5. **Slack** - Channel management and messaging (requires `SLACK_BOT_TOKEN`, `SLACK_TEAM_ID`)
6. **Filesystem** - Local file system access
7. **Brave Search** - Web search via Brave API (requires `BRAVE_API_KEY`)
8. **Memory** - Graph-based memory for context persistence
9. **Exa Search** - Neural search engine integration (requires `EXA_API_KEY`)
10. **AWS** - AWS Resource management (requires `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`)
11. **Stripe** - Payment and subscription management (requires `STRIPE_API_KEY`)
12. **Redis** - Key-value store interaction (requires `REDIS_URL`)
13. **Docker** - Container and image orchestration
14. **Kubernetes** - K8s cluster inspection
15. **GitLab** - GitLab DevOps platform integration (requires `GITLAB_PERSONAL_ACCESS_TOKEN`)
16. **Supabase** - Supabase project management (requires `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`)
17. **Snowflake** - Data warehouse querying (requires `SNOWFLAKE_ACCOUNT`, `SNOWFLAKE_USER`, `SNOWFLAKE_PASSWORD`)
18. **Zapier** - Workflow automation via Zapier NLA (requires `ZAPIER_NLA_API_KEY`)
19. **Shopify** - E-commerce store management (requires `SHOPIFY_SHOP_NAME`, `SHOPIFY_API_PASSWORD`)
20. **Context7** - Real-time documentation and code context (requires `CONTEXT7_API_KEY`)

## How It Works

1. The script reads `backend/data/top-20-servers.json`
2. For each server in the manifest:
   - Converts the format to match registry requirements
   - Generates a `serverId` in format `modelcontextprotocol/{id}` (or `context7/{id}` for Context7)
   - Converts `env` array to a record structure
   - Calls `registryService.publishServer()` to register the server
   - Handles duplicate registrations gracefully (skips if already exists)

## Environment Variables

Servers that require environment variables will have them listed in the `env` array. Users will need to provide actual values when installing these servers. The registry stores the variable names but not the values (for security).

## Tool Discovery

For STDIO-based servers (those with `command` and `args`), the registry will automatically discover available tools after registration. This happens asynchronously and may take a few moments.

## Error Handling

The script handles:
- **Duplicate registrations**: Skips servers that already exist (no error)
- **Network errors**: Reports failure but continues with remaining servers
- **Invalid data**: Reports error and continues

## Verification

After running the script, you can verify registration by:

1. **Checking the registry API**:
   ```bash
   curl http://localhost:3001/api/v0.1/servers
   ```

2. **Using the web UI**: Navigate to `/registry` in the application

3. **Checking the database**: Use Prisma Studio:
   ```bash
   cd backend
   npm run prisma:studio
   ```

## Updating the Manifest

To add or modify servers:

1. Edit `backend/data/top-20-servers.json`
2. Run the registration script again
3. The script will skip existing servers and register new ones

## Notes

- The `-y` flag in `args` prevents npm from prompting "Proceed to install?" which would hang the registry
- Server IDs follow the format `org.name/server-name` as required by the MCP specification
- All servers are registered with `publishedBy: 'system'` to indicate automated registration
- Metadata includes npm package information for easier installation

### Important: Package Name Verification

⚠️ **Note**: The npm package names in the manifest (e.g., `@modelcontextprotocol/server-playwright`) may not exist on npm yet. These are the expected package names based on the MCP specification, but you should verify they exist before running the registration script.

If packages don't exist:
- The registration will still succeed (servers will be registered)
- Tool discovery will fail with a "package not found" error (this is expected)
- Tools can be discovered later when the packages become available
- You can manually update the manifest with correct package names if they differ

To verify a package exists:
```bash
npm view @modelcontextprotocol/server-playwright
```

If a package doesn't exist, you can either:
1. Wait for the package to be published
2. Update the manifest with the correct package name
3. Register the server without command/args (as an HTTP server if available)

## Troubleshooting

### "Manifest file not found"
- Ensure you're running from the correct directory
- Check that `backend/data/top-20-servers.json` exists

### "Database connection error"
- Ensure the backend database is configured and accessible
- Check `DATABASE_URL` in your `.env` file

### "Server already exists"
- This is normal for servers that were previously registered
- The script will skip them and continue

### "Failed to discover tools"
- This is expected for some servers
- Tools will be discovered automatically when the server is first used

