# Fix CORS Error for AWS Amplify

## Problem
Frontend on Amplify (`main.d2cddqmnkv63mg.amplifyapp.com`) can't connect to backend - CORS error.

## Solution: Update Backend CORS_ORIGIN

Your backend needs to allow requests from your Amplify domain.

### Step 1: Get Your Amplify Domain

From the error, I can see your Amplify domain is:
- `main.d2cddqmnkv63mg.amplifyapp.com`

You might also have:
- `slashmcp.com` (your production domain)

### Step 2: Update Backend .env

Edit `backend/.env` and update `CORS_ORIGIN`:

```env
CORS_ORIGIN="https://slashmcp.com,https://www.slashmcp.com,https://main.d2cddqmnkv63mg.amplifyapp.com"
```

**Or if you only want the main domain:**
```env
CORS_ORIGIN="https://slashmcp.com,https://main.d2cddqmnkv63mg.amplifyapp.com"
```

### Step 3: Update Cloud Run Environment Variable

1. **Go to Cloud Run Console**: https://console.cloud.google.com/run/detail/us-central1/mcp-registry-backend?project=554655392699

2. Click **"Edit & Deploy New Revision"**

3. Go to **"Variables & Secrets"** tab

4. Find `CORS_ORIGIN` environment variable (or add it if it doesn't exist)

5. Update it to:
   ```
   https://slashmcp.com,https://www.slashmcp.com,https://main.d2cddqmnkv63mg.amplifyapp.com
   ```
   
   **Important**: Separate domains with commas (no spaces!)

6. Click **"Deploy"**

### Step 4: Verify

After deployment:
1. Visit your Amplify site
2. Refresh the page
3. The CORS error should be gone!

## Quick Command (After updating .env):

You can also use the deploy script to update just the environment variables:

```powershell
cd backend
.\deploy.ps1 -SetEnvVars
```

This will read from your `.env` file and update Cloud Run.

## Notes

- Multiple domains: Separate with commas (no spaces)
- Include both `slashmcp.com` and `www.slashmcp.com` if you use both
- Include the Amplify preview domain (`main.d2cddqmnkv63mg.amplifyapp.com`)
- After updating, wait 1-2 minutes for deployment

