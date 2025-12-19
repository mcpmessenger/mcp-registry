# Changelog

All notable changes to the MCP Registry project will be documented in this file.

## [Unreleased]

### Changed
- **API Version Migration**: Updated all API endpoints from `/v0/` to `/v0.1/` to align with official MCP Registry specification
  - All registry endpoints now use `/v0.1/` prefix (e.g., `/v0.1/servers`, `/v0.1/publish`)
  - Added query parameter support for server discovery: `?search=<term>` and `?capability=<name>`
  - Enhanced CORS configuration with documentation references to official guide
  - Updated all frontend API calls to use new v0.1 endpoints
  - See [MIGRATION_V0.1.md](./MIGRATION_V0.1.md) for migration details

### Added
- **Voice Transcription**: Real-time voice-to-text transcription using OpenAI Whisper API
  - Browser-based audio recording with MediaRecorder API
  - Backend endpoint: `POST /api/audio/transcribe`
  - Support for multiple audio formats (webm, mp3, wav, etc.)
  - Automatic language detection
- **Document Analysis**: AI-powered document analysis using Google Gemini Vision API
  - Support for PDFs, images (PNG, JPEG, GIF), and text files
  - Backend endpoint: `POST /api/documents/analyze`
  - Extracts text, summaries, and insights from documents
  - Integrated into chat interface for file uploads
- **Screen Capture**: Real browser-based screen capture functionality
  - Uses `getDisplayMedia` API for screen/window capture
  - Captured images can be analyzed via document analysis
  - Visual display in chat with screen capture badge
- **Agent Persistence**: Fixed agent registration and persistence
  - Agents now properly save to database via `/v0.1/publish` endpoint
  - Endpoint extraction from metadata and manifest
  - Backend proxy for MCP tool invocation (`POST /v0.1/invoke`)
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
- **Agent Persistence**: Fixed agents not saving to database - now properly persists via registry API
- **Agent Invocation**: Fixed "Not Found" errors when invoking MCP tools - added backend proxy endpoint
- **TypeScript Compilation**: Fixed Buffer to File conversion issues in Whisper service
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
