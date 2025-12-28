# Backend CORS Configuration for Dual Deployment

Your backend needs to allow requests from both:
- **Vercel** (beta/staging)
- **AWS Amplify** (production - slashmcp.com)

## Current Backend URL
https://mcp-registry-backend-554655392699.us-central1.run.app

## CORS Configuration

After deploying both frontends, update your backend CORS to include all domains:

### Step 1: Get Your URLs

1. **Production**: `https://slashmcp.com` (and `https://www.slashmcp.com` if you use www)
2. **Beta (Vercel)**: Get from Vercel dashboard after deployment (e.g., `https://mcp-registry.vercel.app`)

### Step 2: Update Backend .env

Edit `backend/.env`:

```env
# Allow both production and beta domains
CORS_ORIGIN="https://slashmcp.com,https://www.slashmcp.com,https://your-vercel-app.vercel.app"
```

**Important**: 
- Separate domains with commas (no spaces)
- Include both `slashmcp.com` and `www.slashmcp.com` if you use both
- Replace `your-vercel-app.vercel.app` with your actual Vercel URL

### Step 3: Update Cloud Run

```powershell
cd backend

# Update environment variables only (no rebuild)
.\deploy.ps1 -SetEnvVars
```

Or manually:

```powershell
gcloud run services update mcp-registry-backend `
    --region us-central1 `
    --update-env-vars CORS_ORIGIN="https://slashmcp.com,https://www.slashmcp.com,https://your-vercel-app.vercel.app"
```

### Step 4: Verify

Test both domains:
1. Visit `https://slashmcp.com` - should work
2. Visit your Vercel beta URL - should work
3. Check browser console for CORS errors

## Example CORS_ORIGIN Values

### Minimal (if you don't use www):
```
CORS_ORIGIN="https://slashmcp.com,https://mcp-registry.vercel.app"
```

### With www subdomain:
```
CORS_ORIGIN="https://slashmcp.com,https://www.slashmcp.com,https://mcp-registry.vercel.app"
```

### With custom beta domain:
```
CORS_ORIGIN="https://slashmcp.com,https://www.slashmcp.com,https://beta.slashmcp.com"
```

## Troubleshooting

### CORS errors persist:
- Make sure there are **no spaces** after commas
- Verify domain names match **exactly** (including https://)
- Redeploy backend: `.\deploy.ps1 -SetEnvVars`
- Clear browser cache

### One domain works, other doesn't:
- Double-check the domain is included in CORS_ORIGIN
- Verify the domain matches exactly what's in the browser address bar
- Check Cloud Run logs for CORS rejection messages

