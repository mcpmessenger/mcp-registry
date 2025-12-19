# Changelog

All notable changes to the MCP Registry project will be documented in this file.

## [Unreleased]

### Added
- **SVG Visual Rendering in Chat**: SVGs are now rendered visually in the chat interface with a toggle to view raw code
- **Multi-Tier Fallback Strategy**: Implemented robust fallback system for Gemini API:
  - Tier 1: New `@google/genai` SDK (optional)
  - Tier 2: REST API v1 endpoint (primary, most reliable)
  - Tier 3: Alternative model fallback (automatic retry)
- **Gemini 2.5 Model Support**: Updated to use current Gemini 2.5 models (flash, pro, flash-lite)
- **Frontend API Integration**: Complete API client library with timeout handling and error recovery
- **Progress Streaming**: Real-time job progress updates via Server-Sent Events (SSE)
- **Comprehensive Documentation**: 
  - Bug bounty report for Gemini API compatibility issues
  - Migration guide for Gemini API
  - Frontend debugging guide
  - Implementation summaries

### Changed
- **Model Default**: Changed from `gemini-1.5-flash-001` (retired) to `gemini-2.5-flash` (current)
- **API Client**: Improved error handling with 5-second timeout and better error messages
- **Chat Interface**: Enhanced to detect and render SVG content visually
- **Backend Architecture**: Migrated from SDK-dependent to REST API-first approach

### Fixed
- **Gemini API Compatibility**: Resolved 404 errors by using REST API v1 endpoint and current model names
- **Frontend Hanging**: Fixed infinite loading by adding timeouts and better error handling
- **Port Conflicts**: Added scripts to handle port conflicts gracefully
- **CORS Issues**: Improved CORS configuration for development and production

### Technical Details
- Backend now uses REST API v1 endpoint: `https://generativelanguage.googleapis.com/v1/models/{model}:generateContent`
- Authentication via `x-goog-api-key` header
- Model fallback chain: `gemini-2.5-flash` → `gemini-2.5-pro` → `gemini-pro` (legacy)
- SVG extraction from markdown code blocks and plain text
- Visual SVG rendering with code toggle

## [Previous Versions]

### Initial Implementation
- Core Registry v0.1 API
- MCP Server registration and discovery
- Job tracking with Prisma
- WebSocket and SSE support
- PostgreSQL database integration
