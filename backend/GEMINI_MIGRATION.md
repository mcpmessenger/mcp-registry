# Gemini API Migration & Fallback Strategy

## Overview

This document describes the multi-layered fallback strategy implemented to resolve compatibility issues between the Google Generative AI SDK and the Gemini API v1beta endpoint.

## Problem Statement

The legacy `@google/generative-ai` SDK has hardcoded validation and endpoint mapping that doesn't correctly route identifiers for newer Gemini models (1.5 Flash, 2.0 Flash). This causes `404 Not Found` errors when attempting to use these models with the v1beta API.

## Solution Architecture

Our implementation uses a **three-tier fallback strategy** for maximum reliability:

### Tier 1: New SDK (`@google/genai`)
- Attempts to use the new `@google/genai` SDK if available
- Provides better support for Gemini 1.5/2.0 models
- Gracefully falls back if SDK is not installed

### Tier 2: REST API v1 Endpoint (Primary Fallback)
- **Most reliable method** - bypasses SDK abstraction entirely
- Uses stable `v1` API endpoint instead of `v1beta`
- Direct HTTP calls with `x-goog-api-key` header authentication
- Supports all current Gemini models including:
  - `gemini-1.5-flash-001`
  - `gemini-1.5-pro-001`
  - `gemini-2.0-flash-001`

### Tier 3: Alternative Model Fallback
- If primary model fails, automatically retries with alternative model
- Example: Falls back from `gemini-1.5-flash-001` to `gemini-1.5-pro-001`
- Ensures service continuity even if one model is temporarily unavailable

## Implementation Details

### Code Structure

```typescript
// Primary: Try SDK (if available)
if (this.useSDK && this.sdkModel) {
  try {
    return await this.generateWithSDK(prompt)
  } catch (error) {
    // Fall through to REST API
  }
}

// Fallback: Use REST API v1 endpoint
try {
  return await this.generateWithREST(prompt)
} catch (error) {
  // Fallback: Try alternative model
  if (this.modelName.includes('flash')) {
    this.modelName = 'gemini-1.5-pro-001'
    return await this.generateWithREST(prompt)
  }
}
```

### REST API Implementation

The REST API implementation uses the stable v1 endpoint:

```typescript
const url = `https://generativelanguage.googleapis.com/v1/models/${this.modelName}:generateContent`

const response = await fetch(url, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-goog-api-key': this.apiKey,
  },
  body: JSON.stringify({
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.7,
      topK: 40,
      topP: 0.95,
      maxOutputTokens: 8192,
    },
  }),
})
```

## Configuration

### Environment Variables

```env
# Required
GOOGLE_GEMINI_API_KEY=your_api_key_here

# Optional: Specify model version for better compatibility
# Use specific version tags (e.g., gemini-1.5-flash-001) rather than generic aliases
GEMINI_MODEL_NAME=gemini-1.5-flash-001
```

### Model Name Best Practices

**✅ Recommended (Current Models - December 2024):**
- `gemini-2.5-flash` - Fast, cost-effective (default)
- `gemini-2.5-pro` - More capable for complex tasks
- `gemini-2.5-flash-lite` - Lightest, fastest option

**❌ Deprecated (No Longer Available):**
- `gemini-1.5-flash-001` - Retired
- `gemini-1.5-pro-001` - Retired
- `gemini-2.0-flash-001` - Retired

**⚠️ Legacy (Fallback Only):**
- `gemini-pro` - Legacy model, use as last resort

**Note:** Gemini 1.5 and 2.0 models have been retired. Always use Gemini 2.5 models for current API versions.

## Migration Path

### Option 1: Use REST API (Current Implementation)
- ✅ **Recommended** - Most reliable, no SDK dependencies
- ✅ Works with all Gemini models
- ✅ Bypasses SDK compatibility issues
- ✅ Already implemented and tested

### Option 2: Migrate to @google/genai SDK
If you want to use the new SDK:

```bash
npm install @google/genai
```

The code will automatically detect and use it if available. No code changes needed.

### Option 3: Keep Legacy SDK (Not Recommended)
The legacy `@google/generative-ai` package is deprecated and will stop working with newer models.

## Benefits

1. **Resilience**: Multiple fallback layers ensure service continuity
2. **Compatibility**: Works with all Gemini model versions
3. **Flexibility**: Can switch between SDK and REST API seamlessly
4. **Future-Proof**: REST API approach is provider-agnostic
5. **Performance**: Direct REST calls have lower overhead

## Testing

### Test SDK Path
```bash
npm install @google/genai
# Restart server - should use SDK
```

### Test REST Path
```bash
# Remove @google/genai or let it fail
# Server will automatically use REST API
```

### Test Model Fallback
```bash
# Set invalid model name in .env
GEMINI_MODEL_NAME=invalid-model
# Should fallback to gemini-1.5-pro-001
```

## Monitoring

The implementation logs which strategy is being used:

```
Google Gemini client initialized (SDK: enabled, using REST fallback)
Model: gemini-1.5-flash-001
```

Monitor logs to ensure the expected fallback strategy is active.

## Troubleshooting

### Issue: Still getting 404 errors
**Solution**: Ensure you're using versioned model names (e.g., `gemini-1.5-flash-001`)

### Issue: SDK not working
**Solution**: This is expected - the REST API fallback will handle it automatically

### Issue: Both models failing
**Solution**: Check API key permissions and billing status in Google Cloud Console

## References

- [Google Gemini API Documentation](https://ai.google.dev/api/rest)
- [Model Versioning Guide](https://ai.google.dev/gemini-api/docs/models)
- [SDK Migration Guide](https://ai.google.dev/gemini-api/docs/migrate)
