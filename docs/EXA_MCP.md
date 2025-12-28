# Exa MCP Server (exa-mcp-server)

✅ **Status:** Registered in official servers (id: `io.github.exa-labs/exa-mcp-server`)

## Summary
Exa MCP Server (Exa Labs) provides web search, code search, crawling and research tools via a hosted HTTP MCP endpoint at `https://mcp.exa.ai/mcp`. It is available as an HTTP-based MCP (also runnable via `npx exa-mcp-server`).

## How it was added
- A new `exaServer` entry was added to `backend/src/scripts/register-official-servers.ts` and included in the official servers list.
- Script `npm run register-official` (from `backend/`) seeds the server into the registry database.
- The backend `install-config` generator was improved to recommend `npx -y <npmPackage>` for CLI installs when `metadata.npmPackage` is present.

## How to verify locally 🔧
1. In `backend/` run:

   ```bash
   npm run register-official
   ```

   You should see `✅ Successfully registered: io.github.exa-labs/exa-mcp-server` in the script output.

2. Start the backend server (if not already running):

   ```bash
   npm start
   ```

3. Open the web GUI and navigate to `/registry` (or the Registry page in the app). The `Exa MCP Server` entry should appear.

4. Click the **Install** button on the card to open the Install dialog and generate configuration for `Claude Desktop`, `Cursor`, or `CLI`.

## Example Install Configs
- CLI (recommended):

  ```bash
  npx -y exa-mcp-server
  ```

- Claude Desktop config (JSON):

  ```json
  {
    "mcpServers": {
      "io.github.exa-labs/exa-mcp-server": {
        "url": "https://mcp.exa.ai/mcp"
      }
    }
  }
  ```

## Notes / Follow-ups
- If you want a different default (e.g., to prefer the NPX-based STDIO installation instead of HTTP), we can update `register-official-servers.ts` entry to include `command` and `args` for STDIO.
- To make the app use Exa for generic "search" queries by default, set the backend environment variable `DEFAULT_SEARCH_SERVER_ID` to `io.github.exa-labs/exa-mcp-server` and restart the backend server. This will cause the router to prefer the configured server for search intents.
- I also added a temporary routing override so the router prefers Exa for search queries when it detects a server with `exa` in its name or `metadata.npmPackage` set to `exa-mcp-server`.
- If you'd like a softer, user-facing option instead of an env var, I can add a Settings UI to choose the default search provider (persisted server-side or per-user localStorage), and have the frontend pass the preferred server ID with requests to `/api/mcp/tools/generate`.
- 🔧 Fix: The backend now includes an `Accept: application/json, text/event-stream` header when invoking HTTP MCP endpoints to prevent `HTTP 406 Not Acceptable` errors from servers that negotiate between JSON and SSE responses. You can validate this with `npm run test-mcp-invoke-headers` in the `backend/` folder which starts a local echo server and verifies the header is sent.
- Let me know if you'd like me to implement the Settings UI or persist the default server on the backend (database-backed setting).
