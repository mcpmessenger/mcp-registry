# Create .env file in Cloud Shell

Run this command in Cloud Shell:

```bash
nano .env
```

Then paste your environment variables. Here's a template based on what you should have:

```env
PORT=8080
NODE_ENV=production
DATABASE_URL="postgresql://postgres:Aardvark41%2B@/mcp_registry?host=/cloudsql/slashmcp:us-central1:mcp-registry-db"
CORS_ORIGIN="https://slashmcp.com,https://main.d2cddqmnkv63mg.amplifyapp.com,https://mcp-registry-sentilabs.vercel.app"
ENCRYPTION_SECRET=your-secret-here
ENCRYPTION_SALT=your-salt-here
GOOGLE_GEMINI_API_KEY=your-key-here
GOOGLE_VISION_API_KEY=your-key-here
GOOGLE_OAUTH_CLIENT_ID=your-client-id
GOOGLE_OAUTH_CLIENT_SECRET=your-secret
GOOGLE_OAUTH_REDIRECT_URI=your-redirect-uri
OPENAI_API_KEY=your-key-here
ENABLE_KAFKA=false
KAFKA_BROKERS=
KAFKA_CLIENT_ID=
KAFKA_GROUP_ID=
KAFKA_TOPIC_TOOL_SIGNALS=
KAFKA_TOPIC_ORCHESTRATOR_PLANS=
KAFKA_TOPIC_ORCHESTRATOR_RESULTS=
```

**Important Notes:**
- The DATABASE_URL should use the Cloud SQL Unix socket format (with the connection name)
- Password should be URL-encoded (Aardvark41+ becomes Aardvark41%2B)
- CORS_ORIGIN should include all your domains separated by commas

After pasting:
1. Press `Ctrl+X` to exit
2. Press `Y` to confirm save
3. Press `Enter` to save the file

