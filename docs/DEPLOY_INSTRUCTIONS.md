# Deployment Instructions

## Quick Fix for gcloud Permission Issues

### Problem
gcloud CLI has permission issues accessing Python executable in `C:\Program Files (x86)\Google\Cloud SDK\`

### Solution 1: Run PowerShell as Administrator

1. **Close current PowerShell window**
2. **Right-click PowerShell** → **Run as Administrator**
3. Navigate to project:
   ```powershell
   cd C:\Users\senti\OneDrive\Desktop\mcp-registry\backend
   ```
4. Run the deployment script:
   ```powershell
   .\deploy.ps1
   ```

### Solution 2: Use GCP Console (No CLI needed)

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Select project: `554655392699`
3. Navigate to **Cloud Run** → **mcp-registry-backend**
4. Click **EDIT & DEPLOY NEW REVISION**
5. Under **Container**, click **SELECT** to choose a new image
6. Or use **Cloud Build** to build from source

### Solution 3: Fix gcloud Installation

If you want to fix gcloud permanently:

1. Uninstall Google Cloud SDK
2. Reinstall to a user directory (not Program Files):
   ```powershell
   # Download installer
   # Install to: C:\Users\senti\AppData\Local\Google\Cloud SDK
   ```
3. Add to PATH manually if needed

## Deployment Steps

### Frontend (Automatic - Vercel)

1. **Commit and push changes:**
   ```powershell
   git add .
   git commit -m "Fix: Design request routing and TypeScript errors"
   git push origin main
   ```
2. **Vercel auto-deploys** (2-5 minutes)
3. Check: https://vercel.com/dashboard

### Backend (Manual - Cloud Run)

**Using the deployment script (recommended):**
```powershell
cd backend
.\deploy.ps1
```

**Or manually:**
```powershell
$PROJECT_ID = "554655392699"
gcloud builds submit --tag gcr.io/$PROJECT_ID/mcp-registry-backend --region us-central1 .
gcloud run deploy mcp-registry-backend --image gcr.io/$PROJECT_ID/mcp-registry-backend --platform managed --region us-central1 --allow-unauthenticated
```

## Current Backend URL
- Production: `https://mcp-registry-backend-554655392699.us-central1.run.app`

## Testing After Deployment

1. Go to chat interface
2. Try: "I need a high-resolution marketing poster for our new coffee brand, 'Nebula Brew'. It should look cosmic, dark mode, with neon purple accents."
3. Should route to "Design Generator" instead of "Data Analysis Agent"

