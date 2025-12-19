# Bug Bounty Report: Google Gemini API Model Compatibility Issue

## Executive Summary

**Severity:** High  
**Component:** Google Generative AI API Integration  
**Affected Version:** `@google/generative-ai@^0.21.0`  
**API Version:** v1beta  
**Date Reported:** December 19, 2024  
**Status:** Unresolved

## Description

The Google Generative AI SDK (`@google/generative-ai`) is unable to successfully call the `generateContent` method when using the `v1beta` API endpoint. Multiple model names (`gemini-pro`, `gemini-1.5-flash`, `gemini-2.0-flash`) return `404 Not Found` errors, indicating that these models are either:
1. Not available in the `v1beta` API version
2. Not supported for the `generateContent` method
3. Using incorrect model identifiers

This issue prevents applications from generating content using the Gemini API through the official SDK, forcing developers to either:
- Use undocumented workarounds
- Migrate to alternative SDKs
- Wait for Google to update model availability

## Impact

**User Impact:**
- Complete failure of AI-powered content generation features
- Poor user experience with cryptic error messages
- Application functionality breakage

**Business Impact:**
- Development delays
- Increased support burden
- Potential loss of user trust
- Need for emergency workarounds

**Technical Impact:**
- SDK becomes unusable for production applications
- Forces developers to use REST API directly
- Breaks backward compatibility expectations

## Steps to Reproduce

### Prerequisites
1. Node.js environment
2. Valid Google Gemini API key
3. `@google/generative-ai` package installed

### Reproduction Steps

1. **Install the SDK:**
   ```bash
   npm install @google/generative-ai@^0.21.0
   ```

2. **Initialize the client:**
   ```javascript
   import { GoogleGenerativeAI } from '@google/generative-ai';
   
   const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY);
   ```

3. **Attempt to use `gemini-pro` model:**
   ```javascript
   const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
   const result = await model.generateContent('Generate an SVG of an apple');
   ```

4. **Observe the error:**
   ```
   [GoogleGenerativeAI Error]: Error fetching from 
   https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent: 
   [404 Not Found] models/gemini-pro is not found for API version v1beta, 
   or is not supported for generateContent.
   ```

### Alternative Models Tested

The following models were tested with identical results:

| Model Name | Error | Status |
|-----------|-------|--------|
| `gemini-pro` | 404 Not Found | ❌ Fails |
| `gemini-1.5-flash` | 404 Not Found | ❌ Fails |
| `gemini-1.5-pro` | 404 Not Found | ❌ Fails |
| `gemini-2.0-flash` | 404 Not Found | ❌ Fails |

## Expected Behavior

When calling `getGenerativeModel({ model: 'gemini-pro' })` and subsequently `generateContent()`, the SDK should:
1. Successfully authenticate with the API
2. Make a request to the correct endpoint
3. Return generated content or a meaningful error if the model is unavailable
4. Provide clear documentation on which models are available for which API versions

## Actual Behavior

The SDK:
1. Successfully initializes the client
2. Attempts to call `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent`
3. Receives a `404 Not Found` error
4. Throws an error indicating the model is not found or not supported for `generateContent`
5. Provides no guidance on which models are actually available

## Technical Details

### Error Response

```json
{
  "error": {
    "code": 404,
    "message": "models/gemini-pro is not found for API version v1beta, or is not supported for generateContent. Call ListModels to see the list of available models and their supported methods.",
    "status": "NOT_FOUND"
  }
}
```

### API Endpoint Called

```
POST https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent
```

### SDK Configuration

- **Package:** `@google/generative-ai@^0.21.0`
- **API Version:** v1beta (default)
- **Authentication:** API Key (valid and enabled)

### Environment

- **Node.js:** v20.13.1
- **Platform:** Windows 10
- **API Key Status:** Valid, enabled, with proper permissions

## Proof of Concept

### Minimal Reproduction Code

```javascript
import { GoogleGenerativeAI } from '@google/generative-ai';

async function testGeminiModel() {
  const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY);
  
  try {
    // Test gemini-pro
    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
    console.log('Model initialized:', model);
    
    const result = await model.generateContent('Hello, world!');
    console.log('Success:', result.response.text());
  } catch (error) {
    console.error('Error:', error.message);
    // Expected: 404 Not Found for v1beta API
  }
}

testGeminiModel();
```

### Actual Output

```
Model initialized: GenerativeModel { ... }
Error: [GoogleGenerativeAI Error]: Error fetching from 
https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent: 
[404 Not Found] models/gemini-pro is not found for API version v1beta, 
or is not supported for generateContent. Call ListModels to see the list 
of available models and their supported methods.
```

## Root Cause Analysis

### Hypothesis 1: API Version Mismatch
The `v1beta` API version may not support the models that the SDK is attempting to use. The SDK may need to:
- Use the stable `v1` API version instead
- Or use different model names for v1beta

### Hypothesis 2: Model Deprecation
The models (`gemini-pro`, `gemini-1.5-flash`) may have been deprecated or renamed, but the SDK documentation and examples still reference them.

### Hypothesis 3: SDK Version Mismatch
The SDK version (`0.21.0`) may be outdated and not compatible with current API model availability.

### Hypothesis 4: Missing Model List Endpoint Call
The error message suggests calling `ListModels` to see available models, but the SDK doesn't provide an easy way to do this, and the documentation doesn't clearly indicate which models work with which API versions.

## Suggested Fixes

### Fix 1: Update SDK Documentation
- Clearly document which models are available for which API versions
- Provide a helper method to list available models
- Update examples to use working model names

### Fix 2: Implement Model Discovery
```javascript
// Suggested API
const genAI = new GoogleGenerativeAI(apiKey);
const availableModels = await genAI.listModels();
const workingModel = availableModels.find(m => 
  m.supportsMethod('generateContent') && 
  m.apiVersion === 'v1beta'
);
```

### Fix 3: Default to Stable API Version
The SDK should default to the stable `v1` API version instead of `v1beta` to ensure compatibility.

### Fix 4: Better Error Messages
Instead of a generic 404, provide:
- A list of available models for the API version
- A link to the model documentation
- A suggestion to try the stable API version

### Fix 5: Model Name Validation
Validate model names at initialization time and provide immediate feedback if a model is unavailable.

## Implementation Workaround (Applied)

We have implemented a comprehensive workaround in `mcpmessenger/mcp-registry` that:

1. **Uses REST API v1 Endpoint**: Bypasses SDK entirely and calls the stable v1 API directly
   - Endpoint: `https://generativelanguage.googleapis.com/v1/models/{model}:generateContent`
   - Authentication: `x-goog-api-key` header
   - This approach is provider-agnostic and works reliably

2. **Multi-Tier Fallback Strategy**:
   - Tier 1: Attempts new `@google/genai` SDK if available
   - Tier 2: Falls back to REST API v1 (most reliable)
   - Tier 3: Tries alternative model if primary fails

3. **Version-Specific Model Names**: Uses specific version tags (e.g., `gemini-1.5-flash-001`) rather than generic aliases, as v1beta is sensitive to version specificity.

This workaround ensures the application continues to function while waiting for Google to resolve the SDK compatibility issues.

## Workarounds

### Workaround 1: Use REST API Directly
```javascript
const response = await fetch(
  'https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent',
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: 'Hello, world!' }] }]
    })
  }
);
```

### Workaround 2: Migrate to New SDK
According to documentation, `@google/generative-ai` is deprecated in favor of `@google/genai`. However, migration may require significant code changes.

### Workaround 3: Use Different API Version
If the SDK supports it, try specifying the stable `v1` API version instead of `v1beta`.

## References

- [Google Generative AI SDK Documentation](https://ai.google.dev/docs)
- [Gemini API Models List](https://ai.google.dev/api/rest/generativelanguage/models/list)
- [SDK GitHub Repository](https://github.com/google/generative-ai-nodejs)
- [API Migration Guide](https://ai.google.dev/docs/migrate)

## Additional Information

### Related Issues
- Similar issues reported in community forums
- SDK deprecation notice suggests migration to `@google/genai`
- Lack of clear migration path from old to new SDK

### Testing Performed
- ✅ API key validation (key is valid and enabled)
- ✅ Network connectivity (can reach Google APIs)
- ✅ Multiple model names tested
- ✅ Different SDK initialization methods
- ✅ Error message analysis

### Environment Variables
```env
GOOGLE_GEMINI_API_KEY=AIzaSy... (valid key)
```

## Conclusion

This bug represents a significant compatibility issue between the Google Generative AI SDK and the Gemini API. The lack of clear documentation on model availability and API version compatibility creates a poor developer experience and prevents legitimate use of the SDK.

**Recommendation:** Google should either:
1. Update the SDK to work with available models in v1beta
2. Provide clear migration guidance to the new SDK
3. Improve error messages to guide developers to working solutions
4. Maintain backward compatibility or provide deprecation warnings well in advance

---

**Reported By:** Development Team  
**Contact:** [Your Contact Information]  
**Priority:** High - Blocks production deployment  
**Estimated Fix Time:** Unknown (depends on Google's response)
