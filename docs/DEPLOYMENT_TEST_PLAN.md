# Deployment Testing Plan

This document provides a quick reference for verifying the latest backend deployment (Playwright fix + symlink) and ensuring the frontend is wired to the new Cloud Run service.

**For comprehensive technical architecture and in-depth analysis, see [TECHNICAL_ARCHITECTURE_DEPLOYMENT.md](./TECHNICAL_ARCHITECTURE_DEPLOYMENT.md).**

## Prerequisites

- `gcloud` configured with the `slashmcp` project and sufficient permissions.
- Local `docker` / `gcloud builds` for building the image (not required for verification alone).
- Access to the Cloud Run dashboard or logs for `mcp-registry-backend`.
- Frontend env var `NEXT_PUBLIC_API_URL` pointing to the Cloud Run URL (`https://mcp-registry-backend-554655392699.us-central1.run.app`).

## 1. Rebuild & redeploy backend (when needed)

1. From `backend/`, rebuild and push the image using the Dockerfile:
   ```powershell
   cd C:\Users\senti\OneDrive\Desktop\mcp-registry\backend
   gcloud builds submit --tag gcr.io/slashmcp/mcp-registry-backend:latest --region us-central1
   ```
2. Deploy the pushed image so Cloud Run uses the updated binary:
   ```powershell
   gcloud run deploy mcp-registry-backend `
     --image gcr.io/slashmcp/mcp-registry-backend:latest `
     --region us-central1 --platform managed `
     --set-secrets DATABASE_URL=db-url:latest `
     --add-cloudsql-instances slashmcp:us-central1:mcp-registry-db `
     --set-env-vars RUN_MIGRATIONS_ON_STARTUP=true,REGISTER_OFFICIAL_SERVERS_ON_STARTUP=true,CORS_ORIGIN=https://v0-logo-design-ashen-mu.vercel.app,PLAYWRIGHT_CHROME_EXECUTABLE_PATH=/opt/google/chrome/chrome `
     --memory 2Gi `
     --quiet
   ```
   
   **Note:** The `BROWSER=chromium` and `EXECUTABLE_PATH` environment variables are set in the Playwright MCP server registration (in code), so they're automatically passed when the server is spawned. Memory is set to 2Gi to ensure Chromium has sufficient resources.

## 2. Backend verification

1. Confirm Playwright chrome symlink exists in the deployed image by checking the startup logs:
   ```bash
   gcloud run services logs read mcp-registry-backend --region us-central1 --limit 30
   ```
   Look for logs showing `ln -sf /ms-playwright-browsers/...` or `Chromium binary` statements during build.
2. Hit the health endpoint to ensure the service is ready:
   ```bash
   curl https://mcp-registry-backend-554655392699.us-central1.run.app/health
   ```
   Expect `{ "status": "ok", ... }`. Retry after a minute if you recently deployed.
3. Test the MCP servers list:
   ```bash
   curl https://mcp-registry-backend-554655392699.us-central1.run.app/v0.1/servers
   ```
   A successful JSON response confirms the API is live.
4. If Playwright screenshot requests continue to fail, inspect the Playwright logs for errors referencing `/opt/google/chrome/chrome`.

## 3. Frontend verification

1. Ensure Vercel (or GitHub) env var `NEXT_PUBLIC_API_URL` equals `https://mcp-registry-backend-554655392699.us-central1.run.app`.
2. Trigger a Vercel redeploy:
   - Push the branch to GitHub or use Vercel’s “Redeploy” button.
3. After deployment completes, confirm:
   - Frontend loads without the “Cannot connect to backend” error.
   - Developer Console shows fetch requests to the Cloud Run URL, not `http://localhost:3001`.
4. Optionally, call the Playwright screenshot endpoint from the UI or API client and verify success.

## 4. Troubleshooting notes

- **Buildpack detection errors**: Always run `gcloud builds submit` from the `backend/` folder so the Dockerfile is picked up. Avoid `gcloud run deploy --source .` from the repo root.
- **Playwright errors**: Check `/home/node/.cache/ms-playwright` contents in the logs; the symlink ensures `PLAYWRIGHT_CHROME_EXECUTABLE_PATH=/opt/google/chrome/chrome` points to the downloaded Chromium.
- **CORS or “not running” errors**: Verify `NEXT_PUBLIC_API_URL` is wired correctly and redeployed; the backend will reject requests from `localhost` if the frontend still points there.
