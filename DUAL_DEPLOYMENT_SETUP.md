# Dual Deployment Setup: Vercel (Beta) + Amplify (Production)

This setup deploys your frontend to both:
- **Vercel**: Beta/staging environment (for testing)
- **AWS Amplify**: Production environment (slashmcp.com)

## Backend URL
**https://mcp-registry-backend-554655392699.us-central1.run.app**

## Architecture

```
┌─────────────────┐
│   GitHub Repo   │
└────────┬────────┘
         │
    Push to main
         │
    ┌────┴────┐
    │         │
    ▼         ▼
┌────────┐  ┌──────────┐
│ Vercel │  │ Amplify  │
│ (Beta) │  │ (Prod)   │
└───┬────┘  └────┬─────┘
    │            │
    │            │
    ▼            ▼
beta.your-app   slashmcp.com
  .vercel.app
```

## Step 1: Configure Vercel (Beta/Staging)

### Initial Setup:

1. Go to [vercel.com/new](https://vercel.com/new)
2. Sign in with GitHub
3. Import your repository
4. Configure:
   - **Project Name**: `mcp-registry` (or `mcp-registry-beta`)
   - **Framework**: Next.js (auto-detected)
   - **Root Directory**: `.` (default)
   - **Build Command**: `npm run build`
   - **Output Directory**: `.next`

### Environment Variables:

In Vercel Dashboard → Project → Settings → Environment Variables:

1. Add:
   - **Key**: `NEXT_PUBLIC_API_URL`
   - **Value**: `https://mcp-registry-backend-554655392699.us-central1.run.app`
   - **Environment**: Production, Preview, Development (all)
   - **Optional**: Add `NEXT_PUBLIC_ENV=beta` to identify the environment

2. Deploy - Vercel will give you a URL like: `https://mcp-registry.vercel.app`

### Custom Domain (Optional):

If you want a custom beta domain (e.g., `beta.slashmcp.com`):
1. Vercel Dashboard → Settings → Domains
2. Add domain: `beta.slashmcp.com`
3. Follow DNS instructions

## Step 2: Configure AWS Amplify (Production)

### Environment Variables:

1. Go to [AWS Amplify Console](https://console.aws.amazon.com/amplify/)
2. Select your app (slashmcp.com)
3. App settings → Environment variables
4. Add:
   - **Key**: `NEXT_PUBLIC_API_URL`
   - **Value**: `https://mcp-registry-backend-554655392699.us-central1.run.app`
   - **Environment**: Production
   - **Optional**: Add `NEXT_PUBLIC_ENV=production`

### Deploy:

- Push to `main` branch (auto-deploys)
- OR manually redeploy in Amplify Console

## Step 3: Update Backend CORS

Your backend needs to allow requests from both domains:

```powershell
cd backend

# Edit .env file - update CORS_ORIGIN to include both domains
# CORS_ORIGIN="https://slashmcp.com,https://www.slashmcp.com,https://mcp-registry.vercel.app"
# (Add your actual Vercel URL when you get it)

# Update environment variables
.\deploy.ps1 -SetEnvVars
```

**After you get your Vercel URL**, update it again:

```powershell
# Update CORS_ORIGIN with both domains
gcloud run services update mcp-registry-backend `
    --region us-central1 `
    --update-env-vars CORS_ORIGIN="https://slashmcp.com,https://www.slashmcp.com,https://your-beta.vercel.app"
```

Or if you have a custom beta domain:
```powershell
--update-env-vars CORS_ORIGIN="https://slashmcp.com,https://www.slashmcp.com,https://beta.slashmcp.com"
```

## Step 4: Deployment Workflow

### For Beta Testing:

1. Make changes in your code
2. Push to GitHub `main` branch
3. Both Vercel and Amplify will deploy automatically
4. Test on Vercel beta URL first
5. If everything works, production (Amplify) is already deployed!

### For Production Only:

If you want to test on beta before production:
1. Use a separate branch (e.g., `beta` or `staging`)
2. Configure Amplify to only deploy from `main`
3. Configure Vercel to deploy from `beta` branch
4. Test on Vercel, then merge to `main` for production

## Step 5: Environment Detection in Code (Optional)

You can detect which environment you're in:

```typescript
// In your components
const isProduction = process.env.NEXT_PUBLIC_ENV === 'production' || 
                     window.location.hostname === 'slashmcp.com'

const isBeta = process.env.NEXT_PUBLIC_ENV === 'beta' || 
               window.location.hostname.includes('vercel.app')
```

## Step 6: Verify Both Deployments

### Beta (Vercel):
1. Visit your Vercel URL
2. Open browser console (F12)
3. Check: `[API Client] Using backend URL: https://mcp-registry-backend-554655392699.us-central1.run.app`
4. Test functionality

### Production (Amplify):
1. Visit `https://slashmcp.com`
2. Open browser console (F12)
3. Check: `[API Client] Using backend URL: https://mcp-registry-backend-554655392699.us-central1.run.app`
4. Test functionality

## Troubleshooting

### CORS Errors

Make sure backend CORS includes **all** domains:
- Production: `https://slashmcp.com`
- Production (www): `https://www.slashmcp.com` (if used)
- Beta: `https://your-app.vercel.app`
- Beta (custom): `https://beta.slashmcp.com` (if configured)

Separate multiple domains with commas (no spaces).

### Environment Variable Not Working

- Verify `NEXT_PUBLIC_API_URL` is set in both platforms
- Redeploy after setting environment variables
- Check browser console for the actual URL being used

### One Platform Deploys, Other Doesn't

- Check GitHub webhooks are connected to both platforms
- Verify branch configurations match your workflow
- Check build logs in both platforms

## Summary

✅ **Vercel**: Beta/staging environment for testing
✅ **Amplify**: Production environment (slashmcp.com)
✅ **Backend**: Single backend serves both environments
✅ **CORS**: Configured to allow both domains
✅ **Auto-deploy**: Both platforms deploy on push to `main`

