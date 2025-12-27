# Status Report: Unwanted Image Generation on Search Queries

**Date:** 2025-12-26
**Author:** (automated) GitHub Copilot

## Summary
We implemented several fixes to prevent accidental image generation and to handle related errors, but the system is still attempting to run image-generation for some search queries (e.g., "look for Iration concerts in TX"). This is causing user-visible errors such as API quota / Gemini failures and unnecessary resource usage.

## What I've implemented
- Added `Accept: application/json, text/event-stream` header and fallback retries in `backend/src/services/mcp-invoke.service.ts` to avoid HTTP 406 errors when calling HTTP MCP endpoints. ✅
- Hardened response parsing / formatting to avoid mis-parsing UI labels as event data in `lib/response-formatter.ts`. ✅
- Added routing override to prefer Exa for search intents and an env override `DEFAULT_SEARCH_SERVER_ID`. ✅
- Added quota fallback in `lib/workflow-executor.ts` so Gemini quota errors result in a text-only fallback (no workflow failure). ✅
- Added a heuristic guard to `POST /api/mcp/tools/generate` to only allow image generation when the request explicitly asks for images (keywords) or `allowImageGeneration: true` is set. Implemented in `backend/src/routes/mcp/tools.ts`. ✅
- Added test scripts:
-  - `backend/src/scripts/test-mcp-invoke-headers.ts` — verifies Accept header.
-  - `backend/src/scripts/test-generate-guard.ts` — tests the generate guard behavior.
- Added search-query normalization helpers (`normalizeSearchText()` / `extractFollowUpQuery()`) in `lib/tool-router.ts` and now feed the cleaned text into `NativeOrchestrator.requiresOrchestration()` so follow-ups (including contractions like “when’s”/“where’s”) are less likely to be routed through LangChain/Gemini.

## Remaining issue / observed behavior
- Despite the generate guard and normalization changes, the same user query "look for Iration concerts in TX" (and follow-ups like "when's the next show in Texas") still results in the chat flow routing through LangChain and eventually the Gemini design path, triggering quota errors. The orchestrator is still planning a workflow for that query even though the normalized text should match search heuristics. We need to trace why `requiresOrchestration()` is returning true and why LangChain/Gemini is still chosen.

## Reproduction steps
1. Start backend: `cd backend && npm run start:no-kafka` (skip Kafka prestart if needed)
2. Open the chat UI and run: "look for Iration concerts in TX"
3. Observe the server logs and the chat response: it attempts image generation and returns a Gemini quota message (HTTP 406 or quota/429 messages). Alternatively, run `backend/src/scripts/test-generate-guard.ts` to validate the guard responses.

## Logs & Evidence (examples)
- Example error in chat: `HTTP 406: {"jsonrpc":"2.0","error":{"code":-32000,"message":"Not Acceptable: Client must accept both application/json and text/event-stream"},"id":null}`
- Example quota message in UI: `⚠️ API Quota Exceeded: The Gemini API free tier has very limited quotas for image generation.`

## Files changed (key)
- backend/src/services/mcp-invoke.service.ts (Accept header + retries)
- backend/src/routes/mcp/tools.ts (generate guard, schema: allowImageGeneration)
- lib/workflow-executor.ts (quota fallback)
- lib/response-formatter.ts (parsing hardening)
- backend/src/scripts/test-mcp-invoke-headers.ts (new)
- backend/src/scripts/test-generate-guard.ts (new)

## Suggested next steps / asks for help
- Help identify where in the frontend/chat flow the image generation is being triggered for search queries:
  - Check the code path from chat submission → planning/orchestration → call that ends up invoking `POST /api/mcp/tools/generate` or directly calling the design generator.
- If it's coming from an orchestrator or workflow, please trace the call stack (chat UI log + backend workflow executor logs) for the specific message that triggers image generation.
- Add a frontend UI toggle / setting `Disable image generation by default` so we can disable image generation for testing.
- Add automated integration tests simulating a chat query and asserting that no generate call occurs for pure search queries.

## Priority & Impact
- Priority: High (affects user experience; causes confusing quota errors and can exhaust paid API quotas during testing)
- Impact: Users get blocked by quota errors and the system routes to costly image-generation when not requested.


---

If you'd like, I can open a GitHub issue with the content below and add the `help wanted` label, or create a branch and push a draft PR that adds a UI toggle. Which do you prefer?