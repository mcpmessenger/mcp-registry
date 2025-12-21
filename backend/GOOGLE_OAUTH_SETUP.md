# Google OAuth Setup Guide

This guide explains how to set up Google OAuth authentication for the MCP Registry backend.

## Overview

The MCP Registry now supports **Google OAuth** for user authentication when publishing servers. This replaces the simple header-based authentication (`x-user-id`) with a proper OAuth 2.0 flow.

**Note:** GitHub OAuth is NOT required. The official MCP Registry uses GitHub OAuth, but the MCP v0.1 specification doesn't mandate a specific OAuth provider. Google OAuth is a valid alternative and integrates well with your existing Google APIs.

## Prerequisites

- Google Cloud Platform account
- Access to Google Cloud Console

## Step 1: Create OAuth 2.0 Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select or create a project
3. Navigate to **APIs & Services** > **Credentials**
4. Click **Create Credentials** > **OAuth client ID**
5. If prompted, configure the OAuth consent screen:
   - Choose **External** (unless you have a Google Workspace)
   - Fill in required fields (App name, User support email, Developer contact)
   - Add scopes: `userinfo.email` and `userinfo.profile`
   - Add test users if your app is in testing mode
6. For **Application type**, select **Web application**
7. Configure **Authorized redirect URIs**:
   - Development: `http://localhost:3001/api/auth/google/callback`
   - Production: `https://yourdomain.com/api/auth/google/callback`
8. Click **Create**
9. Copy the **Client ID** and **Client Secret**

## Step 2: Configure Environment Variables

Add the following to your `.env` file in the `backend/` directory:

```env
GOOGLE_OAUTH_CLIENT_ID=your_client_id_here
GOOGLE_OAUTH_CLIENT_SECRET=your_client_secret_here
GOOGLE_OAUTH_REDIRECT_URI=http://localhost:3001/api/auth/google/callback
```

**Note:** The redirect URI is optional. If not set, it defaults to `http://localhost:3001/api/auth/google/callback`.

## Step 3: Restart the Server

After adding the environment variables, restart your backend server:

```bash
cd backend
npm start
```

You should see:
```
Google OAuth client initialized
...
Google OAuth: ✅ Configured
OAuth Login: GET http://localhost:3001/api/auth/google
```

## Usage

### For Frontend Applications

1. **Initiate Login Flow:**
   Redirect users to:
   ```
   GET http://localhost:3001/api/auth/google
   ```
   This redirects to Google's OAuth consent screen.

2. **Handle Callback:**
   After user consents, Google redirects to:
   ```
   GET http://localhost:3001/api/auth/google/callback?code=...
   ```
   The backend returns:
   ```json
   {
     "success": true,
     "message": "Authentication successful",
     "user": {
       "userId": "google_user_id",
       "email": "user@example.com",
       "name": "User Name",
       "picture": "https://..."
     },
     "tokens": {
       "accessToken": "...",
       "refreshToken": "...",
       "idToken": "..."
     }
   }
   ```

3. **Use Token for API Calls:**
   Include the token in the `Authorization` header:
   ```
   Authorization: Bearer <accessToken or idToken>
   ```

### For CLI Tools (like mcp-publisher)

You can use Google OAuth instead of GitHub OAuth:

```bash
# Get authorization URL
curl http://localhost:3001/api/auth/google

# After user authorizes, exchange code for tokens
curl -X POST http://localhost:3001/api/auth/google/callback \
  -d "code=<authorization_code>"

# Use token for publishing
curl -X POST http://localhost:3001/v0.1/publish \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d @server.json
```

### Verify Token

Check if a token is still valid:

```bash
curl -X POST http://localhost:3001/api/auth/google/verify \
  -H "Content-Type: application/json" \
  -d '{"token": "<your_token>", "tokenType": "id_token"}'
```

### Refresh Token

Get a new access token using refresh token:

```bash
curl -X POST http://localhost:3001/api/auth/google/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken": "<refresh_token>"}'
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/google` | GET | Initiate OAuth login flow |
| `/api/auth/google/callback` | GET | Handle OAuth callback |
| `/api/auth/google/verify` | POST | Verify token validity |
| `/api/auth/google/refresh` | POST | Refresh access token |

## Fallback Behavior

If Google OAuth is not configured (missing `GOOGLE_OAUTH_CLIENT_ID`), the system falls back to:
- Header-based authentication (`x-user-id`)
- Anonymous publishing (`publishedBy: 'anonymous'`)

This ensures backward compatibility and allows development without OAuth setup.

## Security Considerations

1. **Never expose Client Secret** - Keep it in `.env` file, never commit to git
2. **Use HTTPS in production** - OAuth requires secure connections
3. **Store tokens securely** - Use HTTP-only cookies or secure session storage
4. **Validate redirect URIs** - Only allow trusted domains
5. **Handle token expiration** - Implement refresh token flow

## Troubleshooting

### "Google OAuth client not initialized"
- Check that `GOOGLE_OAUTH_CLIENT_ID` and `GOOGLE_OAUTH_CLIENT_SECRET` are set
- Restart the server after adding environment variables

### "Invalid redirect URI"
- Ensure the redirect URI in Google Console matches exactly (including protocol and port)
- Check `GOOGLE_OAUTH_REDIRECT_URI` matches the configured URI

### "Token verification failed"
- Tokens expire after 1 hour (access tokens) or can be revoked
- Use refresh token to get a new access token
- Ensure token is passed correctly in `Authorization: Bearer <token>` header

## Comparison: Google OAuth vs GitHub OAuth

| Feature | Google OAuth | GitHub OAuth |
|---------|-------------|--------------|
| **Required?** | No (spec doesn't require it) | No (spec doesn't require it) |
| **Official Registry** | Uses GitHub | Uses GitHub |
| **Integration** | Works with existing Google APIs | Separate provider |
| **User Base** | Google accounts | GitHub accounts |
| **Setup Complexity** | Similar | Similar |

**Conclusion:** Both are valid choices. Google OAuth makes sense if you're already using Google APIs (Gemini, Vision) and want a unified authentication system.
