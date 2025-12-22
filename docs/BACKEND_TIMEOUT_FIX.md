# Backend Timeout Fix

## Problem

The frontend deployed on Vercel was timing out when trying to connect to the Cloud Run backend at `https://mcp-registry-backend-554655392699.us-central1.run.app`.

## Root Cause

1. **Short timeout**: The frontend had a 5-second timeout, which is too short for Cloud Run cold starts
2. **Cold starts**: Cloud Run services can take 10-30 seconds to start on first request after being idle
3. **No retry logic**: Single failed request would immediately show an error

## Solution

### Changes Made

1. **Increased timeout** from 5 seconds to 30 seconds in `lib/api.ts`
   - Allows time for Cloud Run cold starts
   - Still fails fast enough for real errors

2. **Added retry logic** with exponential backoff
   - Retries up to 2 times (3 total attempts)
   - Waits 2s, then 4s between retries
   - Helps handle temporary network issues and cold starts

3. **Better error messages**
   - Distinguishes between timeout and network errors
   - Provides helpful guidance for troubleshooting

### Code Changes

```typescript
// Before: 5 second timeout, no retries
const timeoutMs = 5000

// After: 30 second timeout, with retry logic
const timeoutMs = 30000
// + retry loop with exponential backoff
```

## Testing

The backend is confirmed working:
- Health endpoint: `https://mcp-registry-backend-554655392699.us-central1.run.app/health` ✅
- Servers endpoint: `https://mcp-registry-backend-554655392699.us-central1.run.app/v0.1/servers` ✅

## Next Steps

1. **Deploy updated frontend** to Vercel
2. **Monitor** first request times in browser console
3. **Consider** adding a loading indicator that shows "Backend is starting..." for first-time users

## Additional Recommendations

### For Production

1. **Keep Cloud Run warm**: Set minimum instances to 1 to avoid cold starts
   ```bash
   gcloud run services update mcp-registry-backend \
     --min-instances=1 \
     --region=us-central1
   ```

2. **Monitor cold starts**: Set up Cloud Monitoring alerts for slow response times

3. **Consider CDN**: Use Cloud CDN or Cloudflare in front of Cloud Run for faster responses

### For Development

- Use local backend (`http://localhost:3001`) for faster development
- Set `NEXT_PUBLIC_API_URL=http://localhost:3001` in local `.env.local`
