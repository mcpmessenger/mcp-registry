# Development Checklist

## Immediate Next Steps

### 1. ✅ Complete Database Setup

**Run the migration:**
```bash
cd backend
npm run migrate
```
When prompted, enter a migration name like: `init_mcp_registry`

This will:
- Create the database tables (McpServer, DesignJob, Asset)
- Set up all indexes and relationships

**If you get a "database is locked" error:**
- Close any processes that might be using the database
- Delete `prisma/dev.db-journal` if it exists
- Try the migration again

### 2. ⚙️ Set Up Environment Variables

Create a `.env` file in the `backend/` directory:

```env
# Database (SQLite for dev)
DATABASE_URL="file:./dev.db"

# Server Configuration
PORT=3001
NODE_ENV=development
CORS_ORIGIN=http://localhost:3000

# Google API Keys (Required for SVG generation)
GOOGLE_VISION_API_KEY=your_google_vision_api_key_here
GOOGLE_GEMINI_API_KEY=your_google_gemini_api_key_here
```

**To get Google API keys:**
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable **Vision API** and **Generative AI API** (Gemini)
4. Create API keys in "Credentials"
5. Copy keys to `.env` file

**Note:** For Vision API, you may need service account credentials instead:
- Set `GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json`

### 3. 🌱 Seed the MCP Server

**Register the MCP server in the database:**
```bash
npm run seed
```

This will:
- Register the MCP server with ID `io.github.mcpmessenger/mcp-server`
- Add tool definitions (`generate_svg`, `refine_design`)
- Set up capabilities

### 4. 🚀 Start the Server

**Start the development server:**
```bash
npm start
```

You should see:
```
🚀 Server running on port 3001
📡 Environment: development
🗄️  Database: sqlite
🔌 WebSocket: ws://localhost:3001/ws
📋 Registry API: http://localhost:3001/v0/servers
🛠️  MCP Tools: http://localhost:3001/api/mcp/tools
📊 Streams: http://localhost:3001/api/streams/jobs/:jobId
```

### 5. 🧪 Test the API

**Test the Registry API:**
```bash
# List all servers
curl http://localhost:3001/v0/servers

# Get specific server
curl http://localhost:3001/v0/servers/io.github.mcpmessenger/mcp-server
```

**Test SVG Generation:**
```bash
curl -X POST http://localhost:3001/api/mcp/tools/generate \
  -H "Content-Type: application/json" \
  -d '{
    "description": "minimalist icon, blue palette",
    "style": "modern",
    "colorPalette": ["#0066FF", "#FFFFFF"]
  }'
```

This will return a `jobId`. Use it to:
- Check status: `GET /api/mcp/tools/job/:jobId`
- Stream progress: `GET /api/streams/jobs/:jobId` (SSE)
- Subscribe via WebSocket: `ws://localhost:3001/ws`

**Test Health Check:**
```bash
curl http://localhost:3001/health
```

## Development Workflow

### Daily Development

1. **Start the server:**
   ```bash
   npm start
   ```

2. **View database (optional):**
   ```bash
   npm run prisma:studio
   ```
   Opens Prisma Studio at http://localhost:5555

3. **Make code changes:**
   - Server auto-reloads with `ts-node`
   - No need to restart unless you change environment variables

### Database Changes

**When you modify `prisma/schema.prisma`:**

1. Create a migration:
   ```bash
   npm run migrate
   ```

2. The migration will:
   - Generate SQL migration files
   - Apply changes to database
   - Regenerate Prisma Client

### Testing Endpoints

**Useful tools:**
- **Postman** or **Insomnia** for API testing
- **curl** for quick tests
- **Browser** for SSE endpoints (they stream in real-time)
- **WebSocket clients** (like `wscat`) for WebSocket testing

**Install wscat for WebSocket testing:**
```bash
npm install -g wscat
wscat -c ws://localhost:3001/ws
```

Then send:
```json
{"type": "subscribe", "jobId": "your-job-id"}
```

## Common Issues

### Database Locked
- Close Prisma Studio if open
- Stop the server
- Delete `dev.db-journal`
- Retry migration

### Port Already in Use
- Change `PORT` in `.env`
- Or kill process using port 3001

### Google API Errors
- Verify API keys are correct
- Check API quotas in Google Cloud Console
- Ensure APIs are enabled

### Prisma Client Not Generated
```bash
npm run prisma:generate
```

## Next Development Tasks

### High Priority
- [ ] Connect frontend to backend API
- [ ] Test full workflow: generate → refine → stream
- [ ] Add error handling for missing API keys
- [ ] Add request validation improvements

### Medium Priority
- [ ] Add rate limiting
- [ ] Add authentication/authorization
- [ ] Add logging (Winston/Pino)
- [ ] Add unit tests
- [ ] Add integration tests

### Low Priority
- [ ] Add API documentation (Swagger/OpenAPI)
- [ ] Add monitoring/metrics
- [ ] Optimize database queries
- [ ] Add caching layer

## Frontend Integration

Once backend is running, update frontend to:

1. **Point to backend API:**
   - Update API base URL to `http://localhost:3001`
   - Replace mock data with real API calls

2. **Test endpoints:**
   - `GET /v0/servers` - Replace `mockAgents`
   - `POST /api/mcp/tools/generate` - For SVG generation
   - `GET /api/streams/jobs/:jobId` - For progress updates

3. **WebSocket integration:**
   - Connect to `ws://localhost:3001/ws`
   - Subscribe to job updates
   - Handle real-time progress

## Production Deployment

When ready for production:

1. **Switch to PostgreSQL:**
   - Update `DATABASE_URL` in production `.env`
   - Update `prisma/schema.prisma` provider
   - Run `npm run migrate:deploy`

2. **Set production environment variables:**
   - `NODE_ENV=production`
   - Secure API keys
   - Set proper `CORS_ORIGIN`

3. **Build and deploy:**
   ```bash
   npm run build
   # Deploy dist/ folder to your hosting platform
   ```
