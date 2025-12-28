# Quick Testing Guide

## Current Setup
- ✅ Vercel pipeline already established
- ✅ Backend deployed: https://mcp-registry-backend-554655392699.us-central1.run.app
- ✅ Production: Amplify (slashmcp.com) on `main` branch

## Quick Testing Workflow

### For Quick Testing (Use Vercel Preview)

1. **Create a feature branch**:
   ```bash
   git checkout -b test/my-feature
   ```

2. **Make your changes and commit**:
   ```bash
   git add .
   git commit -m "Test: my changes"
   git push origin test/my-feature
   ```

3. **Vercel automatically creates a preview URL**:
   - Check Vercel dashboard
   - Or check GitHub PR (if you create one)
   - Preview URL format: `https://your-app-git-test-my-feature.vercel.app`

4. **Test the preview URL** - it's automatically connected to your backend!

### For Beta Testing (Dedicated Beta Environment)

1. **Create/use beta branch**:
   ```bash
   git checkout -b beta  # if doesn't exist
   # OR
   git checkout beta     # if exists
   ```

2. **Merge your feature or make changes**:
   ```bash
   git merge test/my-feature
   # OR make changes directly
   ```

3. **Push to beta**:
   ```bash
   git push origin beta
   ```

4. **Vercel deploys to beta**:
   - URL: `https://your-app-git-beta.vercel.app`
   - This is your dedicated beta environment

### For Production

1. **Test on beta first** ✅
2. **Merge to main**:
   ```bash
   git checkout main
   git merge beta
   git push origin main
   ```

3. **Both deploy**:
   - Amplify → https://slashmcp.com (production)
   - Vercel → https://your-app.vercel.app (production)

## Branch Strategy Summary

```
main (production)
  ├─ Amplify → slashmcp.com
  └─ Vercel → production URL

beta (staging)
  └─ Vercel → beta preview URL

feature/* (testing)
  └─ Vercel → feature preview URL (automatic)
```

## Environment Variables

Both Vercel and Amplify should have:
- `NEXT_PUBLIC_API_URL` = `https://mcp-registry-backend-554655392699.us-central1.run.app`

Vercel will use this for all branches (production, preview, beta).

## Backend CORS

Your backend CORS should include:
- Production: `https://slashmcp.com`
- Vercel production: Your Vercel production URL
- Beta/Preview: Vercel automatically handles preview URLs

You may need to update CORS to allow Vercel preview domains if you encounter CORS errors. Vercel preview URLs follow pattern: `*.vercel.app`

## That's It!

Your Vercel setup already handles preview deployments automatically. Just:
1. Push to any branch → Get preview URL
2. Test on preview
3. Merge to main → Deploy to production

No additional setup needed! 🎉

