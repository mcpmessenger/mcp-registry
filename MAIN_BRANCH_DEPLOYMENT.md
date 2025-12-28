# Main Branch Deployment Setup

Pushing to `main` branch will trigger deployments to:
- ✅ **Vercel** (production)
- ✅ **AWS Amplify** (production - slashmcp.com)

## Current Configuration

### Vercel
- ✅ Already connected to GitHub
- ✅ Auto-deploys on push to `main`
- ✅ Environment variable: `NEXT_PUBLIC_API_URL` should be set

### Amplify
- ✅ Connected to GitHub
- ✅ Auto-deploys on push to `main`
- ✅ Environment variable: `NEXT_PUBLIC_API_URL` should be set

## Verify Setup

### 1. Verify Vercel is Connected

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Find your project
3. Go to **Settings** → **Git**
4. Verify:
   - ✅ Repository is connected
   - ✅ Production Branch: `main`
   - ✅ Auto-deploy is enabled

### 2. Verify Amplify is Connected

1. Go to [AWS Amplify Console](https://console.aws.amazon.com/amplify/)
2. Find your app
3. Go to **App settings** → **General**
4. Verify:
   - ✅ Repository is connected
   - ✅ Branch: `main`
   - ✅ Auto-deploy is enabled

### 3. Verify Environment Variables

**Vercel:**
- Settings → Environment Variables
- `NEXT_PUBLIC_API_URL` = `https://mcp-registry-backend-554655392699.us-central1.run.app`
- Should be set for **Production** environment

**Amplify:**
- App settings → Environment variables
- `NEXT_PUBLIC_API_URL` = `https://mcp-registry-backend-554655392699.us-central1.run.app`
- Should be set for **Production** environment

## Deploy to Main

### Step 1: Make Sure You're on Main

```bash
git checkout main
git pull origin main  # Get latest changes
```

### Step 2: Make Your Changes

```bash
# Make your code changes
# ... edit files ...

# Stage changes
git add .

# Commit
git commit -m "Your commit message"
```

### Step 3: Push to Main

```bash
git push origin main
```

### Step 4: Watch Deployments

**Vercel:**
- Go to [Vercel Dashboard](https://vercel.com/dashboard)
- Click on your project
- Watch the "Deployments" tab
- You'll see a new deployment triggered by your push

**Amplify:**
- Go to [AWS Amplify Console](https://console.aws.amazon.com/amplify/)
- Click on your app
- Watch the "Build history" or "Deployments" tab
- You'll see a new build triggered by your push

## Expected Timeline

- **Vercel**: Usually deploys in 2-3 minutes
- **Amplify**: Usually deploys in 3-5 minutes (depending on build complexity)

## Verify Deployments

### Vercel
1. Check deployment status in dashboard
2. Visit your Vercel production URL
3. Open browser console (F12)
4. Look for: `[API Client] Using backend URL: https://mcp-registry-backend-554655392699.us-central1.run.app`

### Amplify (Production)
1. Check build status in Amplify console
2. Visit `https://slashmcp.com`
3. Open browser console (F12)
4. Look for: `[API Client] Using backend URL: https://mcp-registry-backend-554655392699.us-central1.run.app`

## Troubleshooting

### Vercel Not Deploying

1. Check GitHub webhook:
   - Vercel Dashboard → Settings → Git
   - Verify webhook is active
   - Check GitHub repository → Settings → Webhooks
   - Should see Vercel webhook

2. Check branch configuration:
   - Vercel Dashboard → Settings → Git
   - Production Branch should be `main`

3. Manual trigger:
   - Vercel Dashboard → Deployments → "Redeploy"

### Amplify Not Deploying

1. Check branch configuration:
   - Amplify Console → App settings → General
   - Verify branch is set to `main`

2. Check build settings:
   - Amplify Console → App settings → Build settings
   - Verify `amplify.yml` is being used

3. Manual trigger:
   - Amplify Console → Actions → "Redeploy this version"

### Both Not Deploying

1. Check GitHub repository:
   - Verify you pushed to `main` branch
   - Check commit history: `git log --oneline -5`

2. Check webhooks:
   - GitHub repository → Settings → Webhooks
   - Should see both Vercel and Amplify webhooks
   - Check webhook delivery logs for errors

## Quick Test

To test if everything is working:

```bash
# Make a small change
echo "# Test deployment $(date)" >> README.md

# Commit and push
git add README.md
git commit -m "Test: Trigger deployment"
git push origin main
```

Then watch both dashboards for new deployments!

## Summary

✅ **Push to main** → Both platforms auto-deploy
✅ **Vercel** → Production URL
✅ **Amplify** → https://slashmcp.com

No manual steps needed - just push to main! 🚀

