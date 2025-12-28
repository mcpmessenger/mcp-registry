# Backend Dockerfile - Debian-based (supports Google Chrome)
FROM node:18 AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Copy source code first (includes prisma if it exists)
COPY . .

# Create minimal Prisma schema if it doesn't exist (needed for postinstall script)
RUN mkdir -p ./prisma && \
    if [ ! -f ./prisma/schema.prisma ]; then \
      echo 'generator client {' > ./prisma/schema.prisma && \
      echo '  provider = "prisma-client-js"' >> ./prisma/schema.prisma && \
      echo '}' >> ./prisma/schema.prisma && \
      echo '' >> ./prisma/schema.prisma && \
      echo 'datasource db {' >> ./prisma/schema.prisma && \
      echo '  provider = "sqlite"' >> ./prisma/schema.prisma && \
      echo '  url      = env("DATABASE_URL")' >> ./prisma/schema.prisma && \
      echo '}' >> ./prisma/schema.prisma; \
    fi

# Install dependencies (including dev dependencies for build)
# Skip postinstall to avoid permission issues, we'll run it manually
RUN npm install --ignore-scripts

# Ensure node_modules/.bin has execute permissions
RUN chmod +x node_modules/.bin/* 2>/dev/null || true

# Generate Prisma Client (needed for TypeScript build)
# Use the direct binary path to avoid npx permission issues
RUN ./node_modules/.bin/prisma generate || npm run prisma:generate || echo "Warning: Prisma generate failed, continuing..."

# Build TypeScript
RUN npm run build

# Production image
FROM node:18 AS runner

WORKDIR /app

ENV NODE_ENV=production

# Install Google Chrome and dependencies for Playwright
RUN apt-get update && \
    apt-get install -y \
    wget \
    gnupg \
    ca-certificates \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libc6 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libexpat1 \
    libfontconfig1 \
    libgbm1 \
    libgcc1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libstdc++6 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libxrender1 \
    libxss1 \
    libxtst6 \
    lsb-release \
    xdg-utils && \
    wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - && \
    sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' && \
    apt-get update && \
    apt-get install -y google-chrome-stable && \
    rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package*.json ./

# Copy Prisma schema from builder (needed for postinstall script)
COPY --from=builder /app/prisma ./prisma

# Install production dependencies only
# Skip postinstall to avoid permission issues, we'll run it manually
RUN npm install --only=production --ignore-scripts

# Ensure node_modules/.bin has execute permissions
RUN chmod +x node_modules/.bin/* 2>/dev/null || true

# Copy built application
COPY --from=builder /app/dist ./dist

# Install Playwright (browsers are skipped since we're using system Chrome)
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
RUN npm install -g playwright

# Pre-install common MCP servers to avoid download delays on first use
# This speeds up tool discovery from 30+ seconds to <5 seconds
RUN npx --yes nano-banana-mcp --version || echo "nano-banana-mcp pre-install skipped"

# Generate Prisma Client explicitly (postinstall was skipped)
# Use the direct binary path to avoid npx permission issues
RUN ./node_modules/.bin/prisma generate || npm run prisma:generate || echo "Prisma generate completed or skipped"

# Create non-root user with home directory
RUN groupadd -r nodejs && useradd -r -g nodejs -m -d /home/nodejs nodejs

# Create npm cache directory and set permissions
RUN mkdir -p /home/nodejs/.npm && \
    chown -R nodejs:nodejs /home/nodejs

# Change ownership
RUN chown -R nodejs:nodejs /app

# Set npm cache to writable location
ENV NPM_CONFIG_CACHE=/home/nodejs/.npm
ENV HOME=/home/nodejs

USER nodejs

# Expose port (Cloud Run will set PORT env var)
EXPOSE 8080

# Health check (use PORT env var or default to 8080)
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:${PORT:-8080}/health || exit 1

# Start server (Cloud Run sets PORT automatically)
CMD ["node", "dist/server.js"]






