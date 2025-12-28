# GitHub Branch-Based Testing Setup

Since your Vercel pipeline is already established, let's set up a testing workflow using GitHub branches.

## Strategy

- **`main` branch** → Production (Amplify - slashmcp.com)
- **`beta` or `test` branch** → Beta/Staging (Vercel)

## Step 1: Configure Vercel for Beta Branch

### Option A: Create/Use Beta Branch (Recommended)

1. **Create a beta branch** (if you don't have one):
   ```bash
   git checkout -b beta
   git push -u origin beta
   ```

2. **In Vercel Dashboard**:
   - Go to your project → **Settings** → **Git**
   - Under **Production Branch**: Keep `main` (or change if you want)
   - Under **Preview Branches**: Make sure `beta` is enabled
   - OR create a separate Vercel project for beta branch

### Option B: Use Preview Deployments

Vercel automatically creates preview deployments for every branch and PR:
- Push to `beta` → Gets preview URL
- Push to `main` → Gets production URL

No additional configuration needed! Just push to `beta` branch.

## Step 2: Configure Amplify for Production Only

1. **In AWS Amplify Console**:
   - Go to your app → **App settings** → **Build settings**
   - Ensure **Branch** is set to `main` only
   - This ensures Amplify only deploys from `main` branch

## Step 3: Update Vercel Environment Variables

Make sure beta environment has the correct backend URL:

1. **Vercel Dashboard** → Your project → **Settings** → **Environment Variables**
2. Verify `NEXT_PUBLIC_API_URL` is set for:
   - ✅ Production (main branch)
   - ✅ Preview (beta branch and PRs)

## Step 4: Workflow

### For Testing:

```bash
# 1. Create feature branch
git checkout -b feature/my-new-feature

# 2. Make changes
# ... edit files ...

# 3. Commit and push
git add .
git commit -m "Add new feature"
git push origin feature/my-new-feature

# 4. Vercel will create a preview deployment automatically
# Get the preview URL from Vercel dashboard or GitHub PR
```

### For Beta Testing:

```bash
# 1. Switch to beta branch
git checkout beta

# 2. Merge or cherry-pick your feature
git merge feature/my-new-feature
# OR
git cherry-pick <commit-hash>

# 3. Push to beta
git push origin beta

# 4. Vercel will deploy to beta URL
```

### For Production:

```bash
# 1. Make sure beta is tested and working
# 2. Switch to main
git checkout main

# 3. Merge beta into main
git merge beta

# 4. Push to main
git push origin main

# 5. Both Amplify (production) and Vercel will deploy
```

## Step 5: Update Backend CORS

Make sure backend allows both domains:

```powershell
cd backend

# Edit .env
# CORS_ORIGIN="https://slashmcp.com,https://your-vercel-beta-url.vercel.app"

# Update
.\deploy.ps1 -SetEnvVars
```

## Step 6: Verify Setup

1. **Push to beta branch** → Check Vercel dashboard for deployment
2. **Push to main branch** → Check both Amplify and Vercel for deployments
3. Test both URLs to ensure they work

## Alternative: Use GitHub Actions for Branch Management

If you want more control, you can create a GitHub Actions workflow (see `.github/workflows/deploy.yml` example below).

## Quick Reference

| Branch | Deploys To | URL |
|--------|-----------|-----|
| `main` | Amplify (production) | https://slashmcp.com |
| `main` | Vercel (production) | https://your-app.vercel.app |
| `beta` | Vercel (preview) | https://your-app-git-beta.vercel.app |
| `feature/*` | Vercel (preview) | https://your-app-git-feature-*.vercel.app |

