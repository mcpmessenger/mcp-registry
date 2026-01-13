# Slash MCP Application and MCP Server Testing Report

**Author:** Manus AI
**Date:** December 30, 2025
**Goal:** Test the Slash MCP application, verify MCP server functionality, test the server registration process, and provide technical feedback based on repository review.

## 1. Executive Summary

The Slash MCP application presents a clean, modern, and intuitive user interface for interacting with Model Context Protocol (MCP) servers. The core functionality of navigating between the chat interface and the registry, as well as the process for adding a new MCP server, were successfully validated.

However, a **critical, systemic issue** was identified in the application's ability to successfully invoke tools on the registered MCP servers. All tested servers in the dropdown menu failed to execute a simple command, primarily due to an apparent failure in mapping the user's natural language query to the specific JSON arguments required by the target tool. This issue renders the primary function of the application—interacting with MCP servers—non-functional.

Technical review of the provided repository, specifically the orchestrator's matching logic, confirms this hypothesis and provides a clear path for remediation.

## 2. Application Interface and Server Registration Review

### 2.1. User Interface and Navigation

The application's design is professional and responsive. Navigation between the **Chat** and **Registry** tabs is seamless. The agent selection dropdown is clearly presented and easy to use.

### 2.2. MCP Server Registration Test

The process for adding a new MCP server via the **Registry** page was successfully tested.

| Step | Action | Result | Status |
| :--- | :--- | :--- | :--- |
| 1 | Navigate to Registry | Success | Pass |
| 2 | Click "Add New MCP" | Success | Pass |
| 3 | Fill in dummy server details | Success | Pass |
| 4 | Confirm Registration | Success | Pass |

The new server appeared in the registry list, confirming that the front-end form submission and back-end registration logic are functioning correctly.

## 3. MCP Server Functionality Testing

A sample of the pre-integrated MCP servers available in the chat dropdown was tested with simple, context-appropriate queries. The results are summarized in the table below.

| MCP Server | Test Query | Expected Result | Actual Result | Status | Error Type |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Brave Search** | "What is the current weather in San Francisco?" | Weather information | Error: `422 SUBSCRIPTION_TOKEN_INVALID` | **Fail** | API Key/Configuration |
| **Memory** | "Remember that my favorite color is blue." | Confirmation of memory storage | Error: `MCP error -32602: Invalid arguments for tool create_entities: [...] expected: "array", received: undefined` | **Fail** | Argument Mapping |
| **Filesystem** | "List the files in the current directory." | List of files | Error: `MCP error -32602: Invalid arguments for tool read_file: [...] expected: "string", received: undefined` | **Fail** | Argument Mapping |
| **Playwright MCP Server** | "Navigate to google.com and tell me the title of the page." | Page title | Error: `404: Not Found` on tool invocation | **Fail** | Server Endpoint/Tool Path |
| **GitHub, Slack, Nano Banana MCP, LangChain Agent MCP Server** | Simple, relevant queries | Tool execution | All failed with similar validation errors (e.g., missing required string/array arguments) | **Fail** | Argument Mapping |

The test results indicate two primary categories of failure:
1.  **Configuration Errors:** The Brave Search server is non-functional due to an invalid or missing API key. The Playwright server is returning a 404, suggesting an incorrect endpoint or tool path.
2.  **Systemic Argument Mapping Errors:** The majority of failures stem from the MCP server receiving an invalid or incomplete set of arguments for the requested tool. This points to a flaw in the orchestrator's logic for translating the user's natural language into the required JSON tool call structure.

## 4. Repository Review and Technical Analysis

The repository review focused on the orchestration logic, specifically the files responsible for matching user queries to tools and preparing the arguments.

### 4.1. Analysis of Argument Mapping

The file `backend/src/services/orchestrator/matcher.ts` is responsible for identifying the target tool and generating the parameters (`params`) that are passed to the tool invocation service.

The function `extractSearchParams(query)` (lines 45-64) is a generic utility designed to extract only two potential parameters: `query` and `location`.

```typescript
// backend/src/services/orchestrator/matcher.ts (Simplified)
function extractSearchParams(query: string): Record<string, unknown> {
  const params: Record<string, unknown> = {}
  // ... logic to extract 'query' and 'location' ...
  return params
}
```

This generic `params` object is then used for *all* tool signals (line 154: `params: match.params`).

**The Problem:** MCP tools require specific, often complex, arguments. For example:
*   The Memory server's `create_entities` tool likely requires an `entities` argument, which must be an array of objects.
*   The Filesystem server's `read_file` tool requires a `path` argument, which must be a string.

Since `extractSearchParams` only returns `query` and `location` (or an empty object), the required arguments are missing, leading to the consistent validation errors observed across multiple servers:

> `MCP error -32602: Input validation error: Invalid arguments for tool create_entities: [ { "expected": "array", "code": "invalid_type", "path": [ "entities" ], "message": "Invalid input: expected array, received undefined" } ]`

The orchestrator is successfully identifying the tool, but it is failing to generate the correct, structured arguments for that tool.

## 5. Recommendations

Based on the testing and technical analysis, the following recommendations are provided to improve the stability and functionality of the Slash MCP application.

### 5.1. Priority 1: Fix Argument Mapping Logic

The current generic parameter extraction must be replaced with a robust mechanism that can generate the specific JSON arguments required by the target tool's schema.

**Technical Suggestion:**
Implement a large language model (LLM) based function-calling approach. The process should be:
1.  The `matcher.ts` identifies the target tool (e.g., `create_entities` on the Memory server).
2.  The orchestrator retrieves the full JSON schema for the identified tool.
3.  The user's natural language query, the tool's schema, and the tool's description are passed to a powerful LLM (e.g., GPT-4.1 or Gemini 2.5) with a function-calling prompt.
4.  The LLM's output (the structured JSON arguments) is then used as the `params` for the `ToolSignalEvent`.

This approach will ensure that the arguments are correctly structured and validated against the tool's schema before being sent to the MCP server.

### 5.2. Priority 2: Address Configuration Errors

The configuration for the Brave Search and Playwright servers needs immediate attention.

*   **Brave Search:** Verify that the `SUBSCRIPTION_TOKEN` is correctly configured and active in the environment variables or server metadata.
*   **Playwright MCP Server:** Investigate the cause of the `404: Not Found` error. This likely requires checking the deployed Playwright server's logs and ensuring the `invokeUrl` generated in `mcp-invoke.service.ts` (around line 220) correctly points to a valid `/mcp/invoke` endpoint.

### 5.3. Priority 3: Enhance User-Facing Error Reporting

The current error messages are highly technical and confusing for a non-developer user.

**Technical Suggestion:**
In `backend/src/services/mcp-invoke.service.ts` (around line 94, where the error is caught), implement logic to simplify the error message before it is returned to the user.

| Technical Error Message Snippet | Suggested User-Facing Message |
| :--- | :--- |
| `MCP error -32602: Input validation error: Invalid arguments for tool...` | "The server could not understand your request. Please try rephrasing or check the tool's documentation." |
| `Error: Brave API error: 422 {"error":{"code":"SUBSCRIPTION_TOKEN_INVALID"...` | "The Brave Search server is currently unavailable due to a configuration error (API key invalid)." |
| `Failed to invoke tool on server: HTTP 404: Not Found` | "The Playwright server is currently unreachable or misconfigured. Please check the server's endpoint." |

This will significantly improve the user experience and provide clearer feedback when a tool fails.

***

## References

[1] Slash MCP Application Interface. `https://slashmcp.com`
[2] mcpmessenger/mcp-registry GitHub Repository. `https://github.com/mcpmessenger/mcp-registry`
[3] `backend/src/services/orchestrator/matcher.ts` file in repository.
[4] `backend/src/services/mcp-invoke.service.ts` file in repository.
