Title: Unwanted image-generation triggered for search queries (e.g., "Iration concerts in TX")

Labels: bug, help wanted, area: backend, area: frontend, priority: high

---

## Problem
A plain search query like "look for Iration concerts in TX" is triggering the image-generation/design flow (Nano Banana / Gemini) and returning quota or Accept negotiation errors. This should not happen for ordinary search queries.

## What I changed
- Added Accept header + fallback retries for HTTP MCP calls in `backend/src/services/mcp-invoke.service.ts`.
- Hardened parse/formatting logic in `lib/response-formatter.ts` to skip UI link labels and better extract artists.
- Added quota fallback in `lib/workflow-executor.ts` so Gemini errors return a text-only fallback (no workflow failure).
- Added a generate-guard in `backend/src/routes/mcp/tools.ts` that requires explicit image keywords or `allowImageGeneration=true` to proceed.
- Added tests: `backend/src/scripts/test-mcp-invoke-headers.ts`, `backend/src/scripts/test-generate-guard.ts`.
- Normalized search-like phrases (`when’s`, `where’s`, etc.) in `lib/tool-router.ts` and now feed the cleaned text into `NativeOrchestrator.requiresOrchestration()` so single-step concert queries are less likely to be routed through LangChain/Gemini.

## Reproduction
1. Start backend: `cd backend && npm run start:no-kafka`
2. In the chat UI, send: `look for Iration concerts in TX`
3. Observe that the backend attempts to perform image generation and returns Gemini quota/406 errors.

## Logs / Output
- Example chat error: `HTTP 406: {"jsonrpc":"2.0","error":{"code":-32000,"message":"Not Acceptable: Client must accept both application/json and text/event-stream"},"id":null}`
- Example quota message: `⚠️ API Quota Exceeded: The Gemini API free tier has very limited quotas for image generation.`

-## Request for help
- Can someone help trace the frontend/orchestrator code path that decides to call the design generator for this query? Specifically:
  - Which module/function in the chat UI or orchestrator triggers the `POST /api/mcp/tools/generate` call for search queries, or falls back to LangChain when orchestration is considered necessary?
  - Are there heuristics in the native orchestrator (e.g., `requiresOrchestration()` or follow-up context handling) that still cause LangChain/Gemini to be selected even after normalizing the text?
- Proposed short-term mitigation: add a frontend setting to disable image generation by default. Can someone implement a quick UI toggle and pass `allowImageGeneration=false` on chat-based search requests?

## Notes
- The guard returns a helpful 400 when a non-image request attempts to use `/api/mcp/tools/generate` without explicit keywords. However, the chat flow may bypass that endpoint and call generation via another code path.

---

If helpful I can open this as a GitHub issue in this repo and add the labels; I can also include stack traces and exact server logs if you tell me which specific chat session to inspect.