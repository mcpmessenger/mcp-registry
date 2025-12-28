# Get Your Cloud Run Service URL

Your deployment was successful! The service URL wasn't captured due to gcloud permission warnings, but you can get it easily.

## Option 1: Check Cloud Console (Easiest)

1. Go to: https://console.cloud.google.com/run/detail/us-central1/mcp-registry-backend?project=554655392699
2. The service URL will be displayed at the top of the page
3. It should look like: `https://mcp-registry-backend-[hash].us-central1.run.app`

## Option 2: Use Admin PowerShell

Open PowerShell as Administrator and run:

```powershell
gcloud run services describe mcp-registry-backend --region us-central1 --format 'value(status.url)'
```

## Option 3: Try Standard URL Format

Based on your project settings, try this URL (may need adjustment):

```
https://mcp-registry-backend-554655392699.us-central1.run.app/health
```

Open this in your browser - if it works, that's your service URL!

## Next Steps Once You Have the URL:

1. **Test the health endpoint:**
   - Open: `https://your-service-url/health`
   - Should return a successful response

2. **Continue with frontend deployment** (see DEPLOY_STEPS.md Step 5)

3. **Set NEXT_PUBLIC_API_URL in Vercel** to your service URL

