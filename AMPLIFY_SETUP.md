# AWS Amplify Deployment Setup

This document outlines the setup for deploying SlashMCP.com to AWS Amplify.

## Prerequisites

1. AWS Amplify account
2. GitHub repository connected
3. Backend API URL: `https://mcp-registry-backend-554655392699.us-central1.run.app`

## Amplify Configuration

The `amplify.yml` file is configured for Next.js deployment with pnpm.

### Build Settings

- **Framework**: Next.js
- **Package Manager**: pnpm
- **Build Command**: `pnpm run build`
- **Output Directory**: `.next`

## Environment Variables

Set the following environment variables in the Amplify Console:

1. **NEXT_PUBLIC_API_URL** (Optional)
   - Default: `https://mcp-registry-backend-554655392699.us-central1.run.app`
   - Only set if you want to use a different backend URL
   - **Note**: Do not use `localhost` URLs in production

### How to Set Environment Variables in Amplify

1. Go to AWS Amplify Console
2. Select your app
3. Go to **App settings** → **Environment variables**
4. Click **Manage variables**
5. Add the variable:
   - Key: `NEXT_PUBLIC_API_URL`
   - Value: `https://mcp-registry-backend-554655392699.us-central1.run.app` (if needed)

## Build Process

Amplify will:
1. Install pnpm globally
2. Run `pnpm install` to install dependencies
3. Run `pnpm run build` to build the Next.js app
4. Deploy the `.next` directory

## Custom Domain (Optional)

You can configure a custom domain in Amplify Console:
1. Go to **Domain management** in your app settings
2. Add your domain (e.g., `slashmcp.com`)
3. Follow the DNS configuration instructions

## Troubleshooting

### Build Fails
- Check that Node.js version is compatible (Next.js 16 requires Node 18+)
- Verify all dependencies are in `package.json`
- Check build logs in Amplify Console

### API Connection Issues
- Verify `NEXT_PUBLIC_API_URL` is set correctly (if custom)
- Check backend CORS settings allow your Amplify domain
- Ensure backend is accessible from public internet

### Runtime Errors
- Check browser console for errors
- Verify environment variables are set correctly
- Check that backend API is responding

