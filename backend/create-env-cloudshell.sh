#!/bin/bash
# Script to create .env file in Cloud Shell
# Run this in Cloud Shell from the backend directory

cat > .env << 'EOF'
# ==========================================
# Database Configuration
# ==========================================
# Cloud Run uses Unix socket connection
DATABASE_URL="postgresql://postgres:Aardvark41%2B@/mcp_registry?host=/cloudsql/slashmcp:us-central1:mcp-registry-db"

# ==========================================
# Server Configuration
# ==========================================
PORT=8080
NODE_ENV=production
CORS_ORIGIN="https://slashmcp.com,https://main.d2cddqmnkv63mg.amplifyapp.com,https://mcp-registry-sentilabs.vercel.app"

# ==========================================
# Security & Encryption
# ==========================================
ENCRYPTION_SECRET="O7bfvPniCmwFIpsX6R4xo1YcjlJeHLTA"
ENCRYPTION_SALT="RiPI1OntCrdvu7Gf5olQAU4qspwzyg32"

# ==========================================
# Google APIs & OAuth
# ==========================================
GOOGLE_GEMINI_API_KEY=AIzaSyCz9bk69IVoPCiznmlyeO8fHUVG9F05NTA
GOOGLE_VISION_API_KEY=AIzaSyCz9bk69IVoPCiznmlyeO8fHUVG9F05NTA
GOOGLE_OAUTH_CLIENT_ID=
GOOGLE_OAUTH_CLIENT_SECRET=
GOOGLE_OAUTH_REDIRECT_URI="http://localhost:3001/api/auth/google/callback"

# ==========================================
# OpenAI
# ==========================================
OPENAI_API_KEY=

# ==========================================
# Kafka (disabled for now)
# ==========================================
ENABLE_KAFKA=false
KAFKA_BROKERS=
KAFKA_CLIENT_ID=
KAFKA_GROUP_ID=
KAFKA_TOPIC_TOOL_SIGNALS=
KAFKA_TOPIC_ORCHESTRATOR_PLANS=
KAFKA_TOPIC_ORCHESTRATOR_RESULTS=
EOF

echo ".env file created!"
echo ""
echo "Important: DATABASE_URL uses Cloud SQL Unix socket format for Cloud Run"
echo "           PORT is set to 8080 (Cloud Run standard)"
echo ""
echo "Review the file: cat .env"
echo "Edit if needed: nano .env"

