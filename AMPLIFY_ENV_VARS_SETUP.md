# Set Environment Variables in AWS Amplify

## Environment Variable Needed

You need to set `NEXT_PUBLIC_API_URL` in AWS Amplify so your frontend knows where to connect to the backend.

## Steps to Set Environment Variables in Amplify

### Step 1: Go to Amplify Console

1. Go to [AWS Amplify Console](https://console.aws.amazon.com/amplify/)
2. Find and click on your app (the one connected to `slashmcp.com`)

### Step 2: Navigate to Environment Variables

1. In your app, click **"App settings"** in the left sidebar
2. Click **"Environment variables"** (under "Build settings")

### Step 3: Add Environment Variable

1. Click **"Manage variables"** button (or "Add variable")

2. Add new variable:
   - **Key**: `NEXT_PUBLIC_API_URL`
   - **Value**: `https://mcp-registry-backend-554655392699.us-central1.run.app`
   - **Environment**: Select **Production** (and Preview if you want it for preview branches too)

3. Click **"Save"**

### Step 4: Redeploy

After adding the environment variable:

1. Go back to your app
2. Click **"Actions"** in the left sidebar (or find the "Redeploy this version" button)
3. Click **"Redeploy this version"** on the latest deployment
   - OR
   - Push a new commit to trigger automatic deployment

## Verify It's Set

1. After deployment completes, visit `https://slashmcp.com`
2. Open browser console (F12)
3. Look for: `[API Client] Using backend URL: https://mcp-registry-backend-554655392699.us-central1.run.app`

## Quick Checklist

- [ ] Go to Amplify Console → Your App → App settings → Environment variables
- [ ] Add: `NEXT_PUBLIC_API_URL` = `https://mcp-registry-backend-554655392699.us-central1.run.app`
- [ ] Set for Production environment
- [ ] Save
- [ ] Redeploy (or push new commit)
- [ ] Test frontend - should connect to backend!

## Important Notes

- **Environment Variable Name**: Must be `NEXT_PUBLIC_API_URL` (the `NEXT_PUBLIC_` prefix makes it available to the browser)
- **Value**: Your Cloud Run backend URL (no trailing slash)
- **Environments**: Set for Production at minimum (preview environments are optional)

