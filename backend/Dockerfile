# Backend Dockerfile
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Copy Prisma schema (needed for postinstall script)
COPY prisma ./prisma

# Install dependencies (including dev dependencies for build)
RUN npm ci

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Production image
FROM node:18-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Install system dependencies needed for Playwright browsers
# These are required for Chromium to run in Alpine Linux
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    freetype-dev \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    || echo "System dependencies install skipped"

# Copy package files
COPY package*.json ./

# Copy Prisma schema (needed for postinstall script)
COPY --from=builder /app/prisma ./prisma

# Install production dependencies only
RUN npm ci --only=production

# Copy built application
COPY --from=builder /app/dist ./dist

# Install Playwright browsers for MCP server support
# This is needed for @playwright/mcp to work
# On Alpine, we use the system Chromium installed above and configure Playwright to use it
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright-browsers
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
RUN npm install -g playwright

# CRITICAL FIX: Ensure entire prisma directory (including migrations) is copied
# This was the root cause - migrations directory was missing
COPY --from=builder /app/prisma ./prisma

# Verify migrations directory exists (fail build if missing)
RUN ls -la /app/prisma/migrations/ || (echo "ERROR: Migrations directory not found!" && exit 1)

# Generate Prisma Client
RUN npx prisma generate

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Prepare Playwright browsers directory and hand ownership to node user
RUN mkdir -p /ms-playwright-browsers && \
    chown -R nodejs:nodejs /ms-playwright-browsers

# Create symlink for Playwright to use system Chromium
# System Chromium is installed at /usr/bin/chromium-browser on Alpine
# We symlink it to the path Playwright expects
RUN mkdir -p /opt/google/chrome && \
    if [ -f /usr/bin/chromium-browser ]; then \
      ln -sf /usr/bin/chromium-browser /opt/google/chrome/chrome && \
      echo "Created symlink: /usr/bin/chromium-browser -> /opt/google/chrome/chrome"; \
    elif [ -f /usr/bin/chromium ]; then \
      ln -sf /usr/bin/chromium /opt/google/chrome/chrome && \
      echo "Created symlink: /usr/bin/chromium -> /opt/google/chrome/chrome"; \
    else \
      echo "Warning: Chromium not found at expected locations"; \
    fi

# Change ownership
RUN chown -R nodejs:nodejs /app

USER nodejs

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:3001/health || exit 1

# Start server
CMD ["node", "dist/server.js"]
